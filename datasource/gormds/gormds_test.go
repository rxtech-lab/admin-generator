package gormds_test

import (
	"testing"

	"github.com/glebarez/sqlite"
	"github.com/rxtech-lab/admin-generator/admin"
	"github.com/rxtech-lab/admin-generator/datasource/gormds"
	"gorm.io/gorm"
)

type widget struct {
	ID    uint   `gorm:"primaryKey" json:"id"`
	Name  string `gorm:"type:varchar(100)" json:"name"`
	Price int    `json:"price"`
}

func newDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	if err := db.AutoMigrate(&widget{}); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	return db
}

func TestGormCRUD(t *testing.T) {
	db := newDB(t)
	ds := gormds.New[widget](db, gormds.WithSearchFields[widget]("name"))
	ctx := t.Context()

	// Create
	for i, name := range []string{"Alpha", "Beta", "Gamma"} {
		w := widget{Name: name, Price: (i + 1) * 10}
		if err := ds.Create(ctx, &w); err != nil {
			t.Fatalf("create %s: %v", name, err)
		}
		if w.ID == 0 {
			t.Errorf("create %s: ID not populated", name)
		}
	}

	// List with pagination
	page, err := ds.List(ctx, admin.ListParams{Limit: 2})
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	if len(page.Items) != 2 {
		t.Fatalf("want 2 items, got %d", len(page.Items))
	}
	if page.NextCursor == "" {
		t.Error("expected a next cursor")
	}
	page2, err := ds.List(ctx, admin.ListParams{Limit: 2, After: page.NextCursor})
	if err != nil {
		t.Fatalf("list page 2: %v", err)
	}
	if len(page2.Items) != 1 {
		t.Fatalf("want 1 item on page 2, got %d", len(page2.Items))
	}

	// Get
	got, err := ds.Get(ctx, "1")
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if got.Name != "Alpha" {
		t.Errorf("get id=1: got %q", got.Name)
	}

	// Update via JSON field names
	updated, err := ds.Update(ctx, "1", map[string]any{"name": "Alpha2", "price": 999})
	if err != nil {
		t.Fatalf("update: %v", err)
	}
	if updated.Name != "Alpha2" || updated.Price != 999 {
		t.Errorf("update result: %+v", updated)
	}

	// Update ignores unknown fields and primary key
	if _, err := ds.Update(ctx, "1", map[string]any{"id": 42, "bogus": "x"}); err != nil {
		t.Fatalf("update with unknown fields: %v", err)
	}
	if _, err := ds.Get(ctx, "42"); err == nil {
		t.Error("primary key should not have been changed to 42")
	}

	// Search
	results, err := ds.Search(ctx, "Beta", 10)
	if err != nil {
		t.Fatalf("search: %v", err)
	}
	if len(results) != 1 || results[0].Title != "Beta" || results[0].Value != "2" {
		t.Errorf("unexpected search results: %+v", results)
	}

	// Delete
	if err := ds.Delete(ctx, "2"); err != nil {
		t.Fatalf("delete: %v", err)
	}
	if _, err := ds.Get(ctx, "2"); err == nil {
		t.Error("id=2 should be deleted")
	}

	// Delete missing → ErrNotFound
	if err := ds.Delete(ctx, "999"); err == nil {
		t.Error("deleting missing row should error")
	}
}
