package response

import (
	"net/http"

	"github.com/labstack/echo/v4"
)

// Body 统一响应体：code 0 成功，非 0 为业务错误码。
type Body struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
	Data    any    `json:"data,omitempty"`
}

func OK(c echo.Context, data any) error {
	return c.JSON(http.StatusOK, Body{Code: 0, Message: "success", Data: data})
}

func Page(c echo.Context, list any, total int64, page, size int) error {
	return c.JSON(http.StatusOK, Body{Code: 0, Message: "success", Data: echo.Map{
		"list": list, "total": total, "page": page, "size": size,
	}})
}

func Fail(c echo.Context, httpStatus, code int, msg string) error {
	return c.JSON(httpStatus, Body{Code: code, Message: msg})
}

func BadRequest(c echo.Context, msg string) error { return Fail(c, http.StatusBadRequest, 400, msg) }
func Unauthorized(c echo.Context, msg string) error {
	return Fail(c, http.StatusUnauthorized, 401, msg)
}
func Forbidden(c echo.Context, msg string) error { return Fail(c, http.StatusForbidden, 403, msg) }
func NotFound(c echo.Context, msg string) error  { return Fail(c, http.StatusNotFound, 404, msg) }
func Error(c echo.Context, msg string) error {
	return Fail(c, http.StatusInternalServerError, 500, msg)
}
