// Package models defines the demo entities exposed through the admin framework.
package models

import "time"

// Author is a blog author. The `table:` tags drive the admin list view and the
// `jsonschema:` tags feed the form schema when Author is edited directly.
type Author struct {
	ID        uint      `gorm:"primaryKey" json:"id" jsonschema:"title=ID" table:"order=0;pinned=true;width=60"`
	Name      string    `gorm:"type:varchar(100);not null" json:"name" jsonschema:"title=Name,required" validate:"required" table:"order=1"`
	Email     string    `gorm:"type:varchar(255);uniqueIndex" json:"email" jsonschema:"title=Email,format=email,required" validate:"required,email" table:"order=2"`
	AvatarURL string    `gorm:"type:varchar(500)" json:"avatarUrl" jsonschema:"title=Avatar" table:"order=3;format=image;width=80"`
	Bio       string    `gorm:"type:text" json:"bio" jsonschema:"title=Bio" table:"omit"`
	CreatedAt time.Time `json:"createdAt" jsonschema:"title=Joined,format=date-time" table:"order=4;format=date-time"`
}

// Post is a blog post belonging to an Author.
type Post struct {
	ID        uint      `gorm:"primaryKey" json:"id" jsonschema:"title=ID" table:"order=0;pinned=true;width=60"`
	Title     string    `gorm:"type:varchar(200);not null" json:"title" jsonschema:"title=Title,required" validate:"required" table:"order=1;width=260"`
	Status    string    `gorm:"type:varchar(20);default:draft" json:"status" jsonschema:"title=Status,enum=draft,enum=published,enum=archived" table:"order=2;format=chip"`
	AuthorID  uint      `gorm:"index" json:"authorId" jsonschema:"title=Author" table:"order=3"`
	Author    Author    `gorm:"foreignKey:AuthorID" json:"author" table:"order=4;valuefrom={{.Author.Name}}"`
	Color     string    `gorm:"type:varchar(20)" json:"color" jsonschema:"title=Label Color" table:"order=5;format=color;width=90"`
	CreatedAt time.Time `json:"createdAt" jsonschema:"title=Created,format=date-time" table:"order=6;format=date-time"`
}
