package db

import (
	"time"

	"github.com/xiaoxin/cms/internal/config"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	gormlogger "gorm.io/gorm/logger"
)

// Open 建立 GORM/Postgres 连接（schema 由 SQL 迁移管理，这里不做 AutoMigrate）。
func Open(cfg *config.Config) (*gorm.DB, error) {
	level := gormlogger.Warn
	if cfg.Database.LogSQL {
		level = gormlogger.Info
	}
	gdb, err := gorm.Open(postgres.Open(cfg.Database.DSN), &gorm.Config{
		Logger:                 gormlogger.Default.LogMode(level),
		SkipDefaultTransaction: true,
	})
	if err != nil {
		return nil, err
	}
	sqlDB, err := gdb.DB()
	if err != nil {
		return nil, err
	}
	sqlDB.SetMaxOpenConns(cfg.Database.MaxOpen)
	sqlDB.SetMaxIdleConns(cfg.Database.MaxIdle)
	sqlDB.SetConnMaxLifetime(time.Hour)
	return gdb, nil
}
