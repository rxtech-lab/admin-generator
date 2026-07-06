package adminhttp_test

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/rxtech-lab/admin-generator/admin"
	"github.com/rxtech-lab/admin-generator/adminhttp"
	"github.com/rxtech-lab/admin-generator/datasource/memory"
)

type post struct {
	ID     uint   `json:"id" jsonschema:"title=ID" table:"order=0;pinned=true"`
	Title  string `json:"title" jsonschema:"title=Title,required" validate:"required" table:"order=1"`
	Status string `json:"status" jsonschema:"title=Status" table:"order=2;format=chip"`
}

func newServer(t *testing.T) (*httptest.Server, *memory.Store[post]) {
	t.Helper()
	store := memory.New[post](memory.WithSearchFields[post]("title"))
	store.Seed(
		post{Title: "First", Status: "published"},
		post{Title: "Second", Status: "draft"},
	)
	reg := admin.NewRegistry()
	reg.Register(admin.NewResource[post](admin.ResourceConfig[post]{
		ID:         "posts",
		Name:       "Posts",
		Icon:       "file-text",
		DataSource: store,
	}))
	srv := httptest.NewServer(adminhttp.New(reg, adminhttp.WithBasePath("/admin")))
	t.Cleanup(srv.Close)
	return srv, store
}

func getJSON(t *testing.T, url string, target any) *http.Response {
	t.Helper()
	resp, err := http.Get(url)
	if err != nil {
		t.Fatalf("GET %s: %v", url, err)
	}
	if target != nil {
		body, _ := io.ReadAll(resp.Body)
		resp.Body.Close()
		if err := json.Unmarshal(body, target); err != nil {
			t.Fatalf("decode %s: %v (body: %s)", url, err, body)
		}
	}
	return resp
}

func TestListResources(t *testing.T) {
	srv, _ := newServer(t)
	var infos []admin.ResourceInfo
	getJSON(t, srv.URL+"/admin/resources", &infos)
	if len(infos) != 1 {
		t.Fatalf("want 1 resource, got %d", len(infos))
	}
	if infos[0].ID != "posts" || infos[0].Type != admin.ResourceTable {
		t.Errorf("unexpected resource info: %+v", infos[0])
	}
	if infos[0].DataURL != "/admin/resources/posts/action?action=view" {
		t.Errorf("unexpected dataUrl: %q", infos[0].DataURL)
	}
}

func TestGetTableSchema(t *testing.T) {
	srv, _ := newServer(t)
	var schema admin.TableSchema
	getJSON(t, srv.URL+"/admin/resources/posts/schema?action=view", &schema)
	if schema.UIType != "table" {
		t.Errorf("want table uiType, got %q", schema.UIType)
	}
	if len(schema.Columns) != 3 {
		t.Fatalf("want 3 columns, got %d", len(schema.Columns))
	}
	if !schema.Columns[0].Pinned {
		t.Error("id column should be pinned")
	}
	if schema.Columns[2].Format != "chip" {
		t.Errorf("status format: got %q", schema.Columns[2].Format)
	}
}

func TestGetFormSchema(t *testing.T) {
	srv, _ := newServer(t)
	var schema admin.FormSchema
	getJSON(t, srv.URL+"/admin/resources/posts/schema?action=create", &schema)
	if schema.UIType != "form" {
		t.Errorf("want form uiType, got %q", schema.UIType)
	}
	if schema.Schema == nil {
		t.Fatal("form schema.schema is nil")
	}
	if len(schema.SupportedActions) == 0 || schema.SupportedActions[0].ActionType != admin.ActionCreate {
		t.Errorf("unexpected supported actions: %+v", schema.SupportedActions)
	}
}

func TestViewListing(t *testing.T) {
	srv, _ := newServer(t)
	resp := getJSON(t, srv.URL+"/admin/resources/posts/action?action=view", nil)
	body, _ := io.ReadAll(resp.Body)
	resp.Body.Close()

	var paginated struct {
		Items []struct {
			Data    map[string]any      `json:"data"`
			Actions []admin.ActionButton `json:"actions"`
		} `json:"items"`
		Actions []admin.ActionButton `json:"actions"`
	}
	if err := json.Unmarshal(body, &paginated); err != nil {
		t.Fatalf("decode: %v (body: %s)", err, body)
	}
	if len(paginated.Items) != 2 {
		t.Fatalf("want 2 items, got %d", len(paginated.Items))
	}
	if paginated.Items[0].Data["title"] != "First" {
		t.Errorf("first item title: got %v", paginated.Items[0].Data["title"])
	}
	// Each row carries edit + delete buttons.
	if len(paginated.Items[0].Actions) != 2 {
		t.Errorf("want 2 row actions, got %d", len(paginated.Items[0].Actions))
	}
}

func TestCreateEditDelete(t *testing.T) {
	srv, store := newServer(t)

	// Create
	created := postAction(t, srv.URL+"/admin/resources/posts/action", admin.ActionCreate, "", map[string]any{"title": "Third", "status": "draft"})
	if created.StatusCode != http.StatusOK {
		t.Fatalf("create status: %d", created.StatusCode)
	}
	page, _ := store.List(t.Context(), admin.ListParams{Limit: 100})
	if len(page.Items) != 3 {
		t.Fatalf("want 3 items after create, got %d", len(page.Items))
	}

	// Edit id=3
	edited := postAction(t, srv.URL+"/admin/resources/posts/action?dynamicPath=3", admin.ActionEdit, "", map[string]any{"title": "Third Edited", "status": "published"})
	if edited.StatusCode != http.StatusOK {
		t.Fatalf("edit status: %d", edited.StatusCode)
	}
	item, err := store.Get(t.Context(), "3")
	if err != nil {
		t.Fatalf("get after edit: %v", err)
	}
	if item.Title != "Third Edited" {
		t.Errorf("edited title: got %q", item.Title)
	}

	// Delete id=3
	deleted := postAction(t, srv.URL+"/admin/resources/posts/action?dynamicPath=3", admin.ActionDelete, "", nil)
	if deleted.StatusCode != http.StatusOK {
		t.Fatalf("delete status: %d", deleted.StatusCode)
	}
	if _, err := store.Get(t.Context(), "3"); err == nil {
		t.Error("item 3 should be deleted")
	}
}

func TestCreateValidationError(t *testing.T) {
	srv, _ := newServer(t)
	// Missing required title.
	resp := postAction(t, srv.URL+"/admin/resources/posts/action", admin.ActionCreate, "", map[string]any{"status": "draft"})
	if resp.StatusCode != http.StatusUnprocessableEntity {
		t.Fatalf("want 422, got %d", resp.StatusCode)
	}
	var body struct {
		Fields map[string]string `json:"fields"`
	}
	dec, _ := io.ReadAll(resp.Body)
	resp.Body.Close()
	json.Unmarshal(dec, &body)
	if _, ok := body.Fields["title"]; !ok {
		t.Errorf("expected title validation error, got %+v", body.Fields)
	}
}

func TestSearch(t *testing.T) {
	srv, _ := newServer(t)
	resp := getJSON(t, srv.URL+"/admin/resources/posts/action?action=search&query=first", nil)
	var results []admin.SearchItem
	body, _ := io.ReadAll(resp.Body)
	resp.Body.Close()
	if err := json.Unmarshal(body, &results); err != nil {
		t.Fatalf("decode search: %v (body: %s)", err, body)
	}
	if len(results) != 1 || results[0].Title != "First" {
		t.Errorf("unexpected search results: %+v", results)
	}
}

func postAction(t *testing.T, url string, action admin.ActionType, _ string, data map[string]any) *http.Response {
	t.Helper()
	payload, _ := json.Marshal(map[string]any{"action": action, "data": data})
	resp, err := http.Post(url, "application/json", bytes.NewReader(payload))
	if err != nil {
		t.Fatalf("POST %s: %v", url, err)
	}
	return resp
}
