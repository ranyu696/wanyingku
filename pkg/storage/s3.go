package storage

import (
	"bytes"
	"context"
	"crypto/sha1"
	"encoding/hex"
	"fmt"
	"image"
	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"
	"io"
	"net/http"
	"path"
	"strings"
	"time"

	blurhash "github.com/buckket/go-blurhash"
	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
	xdraw "golang.org/x/image/draw"
	_ "golang.org/x/image/webp"
)

// S3 是 S3 兼容对象存储客户端（AWS S3 / Cloudflare R2 / 阿里云 OSS / 腾讯 COS / MinIO）。
type S3 struct {
	client     *minio.Client
	bucket     string
	prefix     string
	publicBase string
	http       *http.Client
}

type Options struct {
	Endpoint      string // 不含协议，如 s3.amazonaws.com / xxx.r2.cloudflarestorage.com
	Region        string
	Bucket        string
	AccessKey     string
	SecretKey     string
	UseSSL        bool
	PublicBaseURL string // 公开访问前缀（CDN 域名或桶公开域名），结尾无斜杠
	Prefix        string // 对象 key 前缀，如 images
}

func NewS3(o Options) (*S3, error) {
	// 端点容错：允许带协议（如 Railway/Tigris 提供的 https://t3.storageapi.dev），
	// minio 只接受裸主机名，这里剥掉 scheme 并据此推断是否走 TLS。
	endpoint := o.Endpoint
	secure := o.UseSSL
	if i := strings.Index(endpoint, "://"); i >= 0 {
		secure = strings.HasPrefix(endpoint, "https://")
		endpoint = endpoint[i+3:]
	}
	endpoint = strings.TrimRight(endpoint, "/")
	cli, err := minio.New(endpoint, &minio.Options{
		Creds:  credentials.NewStaticV4(o.AccessKey, o.SecretKey, ""),
		Secure: secure,
		Region: o.Region,
	})
	if err != nil {
		return nil, err
	}
	prefix := strings.Trim(o.Prefix, "/")
	if prefix == "" {
		prefix = "images"
	}
	return &S3{
		client:     cli,
		bucket:     o.Bucket,
		prefix:     prefix,
		publicBase: strings.TrimRight(o.PublicBaseURL, "/"),
		http:       &http.Client{Timeout: 20 * time.Second},
	}, nil
}

func (s *S3) Enabled() bool { return true }

// PresignGet 生成对象的预签名 GET URL（默认 24h）。私有桶下后端 302 重定向到它，
// 图片字节由对象存储直发浏览器（桶出站免费），不经服务转发。
func (s *S3) PresignGet(ctx context.Context, key string) (string, error) {
	u, err := s.client.PresignedGetObject(ctx, s.bucket, key, 24*time.Hour, nil)
	if err != nil {
		return "", err
	}
	return u.String(), nil
}

func (s *S3) Rehost(ctx context.Context, srcURL string) Image {
	if srcURL == "" {
		return Image{}
	}
	if s.publicBase != "" && strings.HasPrefix(srcURL, s.publicBase) {
		return Image{URL: srcURL} // 已是自有图床
	}
	key := s.keyFor(srcURL)

	// 已存在则直接返回（BlurHash 首次入库已存在 title 上）
	if _, err := s.client.StatObject(ctx, s.bucket, key, minio.StatObjectOptions{}); err == nil {
		return Image{URL: s.url(key)}
	}

	data, ctype, err := s.download(ctx, srcURL)
	if err != nil || len(data) == 0 {
		return Image{URL: srcURL}
	}
	bh := computeBlurHash(data)
	_, err = s.client.PutObject(ctx, s.bucket, key, bytes.NewReader(data), int64(len(data)),
		minio.PutObjectOptions{ContentType: ctype, CacheControl: "public, max-age=31536000"})
	if err != nil {
		return Image{URL: srcURL, BlurHash: bh}
	}
	return Image{URL: s.url(key), BlurHash: bh}
}

// computeBlurHash 解码图片、缩到小图后计算 BlurHash 占位（失败返回空串）。
func computeBlurHash(data []byte) string {
	img, _, err := image.Decode(bytes.NewReader(data))
	if err != nil {
		return ""
	}
	b := img.Bounds()
	w, h := b.Dx(), b.Dy()
	if w == 0 || h == 0 {
		return ""
	}
	const maxDim = 64
	nw, nh := w, h
	if w > h && w > maxDim {
		nw, nh = maxDim, h*maxDim/w
	} else if h >= w && h > maxDim {
		nw, nh = w*maxDim/h, maxDim
	}
	if nw < 1 {
		nw = 1
	}
	if nh < 1 {
		nh = 1
	}
	small := image.NewRGBA(image.Rect(0, 0, nw, nh))
	xdraw.ApproxBiLinear.Scale(small, small.Bounds(), img, b, xdraw.Over, nil)
	hash, err := blurhash.Encode(4, 3, small)
	if err != nil {
		return ""
	}
	return hash
}

func (s *S3) keyFor(srcURL string) string {
	sum := sha1.Sum([]byte(srcURL))
	name := hex.EncodeToString(sum[:])
	ext := strings.ToLower(path.Ext(srcURL))
	if len(ext) > 5 || ext == "" {
		ext = ".jpg"
	}
	return fmt.Sprintf("%s/%s%s", s.prefix, name, ext)
}

func (s *S3) url(key string) string {
	if s.publicBase != "" {
		return s.publicBase + "/" + key
	}
	return fmt.Sprintf("https://%s/%s/%s", s.client.EndpointURL().Host, s.bucket, key)
}

func (s *S3) download(ctx context.Context, srcURL string) ([]byte, string, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, srcURL, nil)
	if err != nil {
		return nil, "", err
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (yinshi-image)")
	resp, err := s.http.Do(req)
	if err != nil {
		return nil, "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, "", fmt.Errorf("download %s: http %d", srcURL, resp.StatusCode)
	}
	data, err := io.ReadAll(io.LimitReader(resp.Body, 8<<20)) // 上限 8MB
	if err != nil {
		return nil, "", err
	}
	ctype := resp.Header.Get("Content-Type")
	if ctype == "" {
		ctype = "image/jpeg"
	}
	return data, ctype, nil
}
