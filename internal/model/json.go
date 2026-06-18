package model

import (
	"database/sql/driver"
	"encoding/json"
	"errors"
)

// JSON 是一个 jsonb 列类型，底层为 json.RawMessage。
type JSON json.RawMessage

func (j JSON) Value() (driver.Value, error) {
	if len(j) == 0 {
		return nil, nil
	}
	return []byte(j), nil
}

func (j *JSON) Scan(src any) error {
	if src == nil {
		*j = nil
		return nil
	}
	switch v := src.(type) {
	case []byte:
		*j = append((*j)[:0], v...)
	case string:
		*j = []byte(v)
	default:
		return errors.New("model.JSON: unsupported scan type")
	}
	return nil
}

func (j JSON) MarshalJSON() ([]byte, error) {
	if len(j) == 0 {
		return []byte("null"), nil
	}
	return []byte(j), nil
}

func (j *JSON) UnmarshalJSON(b []byte) error {
	if j == nil {
		return errors.New("model.JSON: UnmarshalJSON on nil pointer")
	}
	*j = append((*j)[:0], b...)
	return nil
}

func (JSON) GormDataType() string { return "jsonb" }
