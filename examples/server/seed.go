package main

import (
	"fmt"
	"log"

	"github.com/rxtech-lab/admin-generator/examples/server/models"
	"gorm.io/gorm"
)

// seed populates demo data once (idempotent: skips if authors already exist).
func seed(db *gorm.DB) {
	var count int64
	db.Model(&models.Author{}).Count(&count)
	if count > 0 {
		return
	}

	authors := []models.Author{
		{Name: "Ada Lovelace", Email: "ada@example.com", AvatarURL: "https://i.pravatar.cc/80?img=1", Bio: "First programmer."},
		{Name: "Alan Turing", Email: "alan@example.com", AvatarURL: "https://i.pravatar.cc/80?img=2", Bio: "Father of computing."},
		{Name: "Grace Hopper", Email: "grace@example.com", AvatarURL: "https://i.pravatar.cc/80?img=3", Bio: "Compiler pioneer."},
	}
	if err := db.Create(&authors).Error; err != nil {
		log.Fatalf("seed authors: %v", err)
	}

	statuses := []string{"draft", "published", "archived"}
	colors := []string{"#ef4444", "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6"}
	tagSets := [][]models.PostTag{
		{
			{Name: "computing", Color: "#3b82f6"},
			{Name: "history", Color: "#f59e0b"},
		},
		{
			{Name: "algorithms", Color: "#10b981"},
		},
		{
			{Name: "hardware", Color: "#ef4444"},
			{Name: "compilers", Color: "#8b5cf6"},
			{Name: "featured", Color: "#f59e0b"},
		},
	}
	var posts []models.Post
	for i := 0; i < 25; i++ {
		posts = append(posts, models.Post{
			Title:    fmt.Sprintf("Post number %d about computing", i+1),
			Status:   statuses[i%len(statuses)],
			AuthorID: authors[i%len(authors)].ID,
			Color:    colors[i%len(colors)],
			Tags:     tagSets[i%len(tagSets)],
		})
	}
	if err := db.Create(&posts).Error; err != nil {
		log.Fatalf("seed posts: %v", err)
	}
	log.Printf("seeded %d authors and %d posts", len(authors), len(posts))
}
