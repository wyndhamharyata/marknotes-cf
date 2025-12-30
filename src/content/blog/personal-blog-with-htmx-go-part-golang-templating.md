---
title: "Personal Blog with HTMX + Go: Part 1 - Golang Templating"
description: "The first part of a series on building a personal blog with HTMX and Go, covering the basics of Go templating with Labstack Echo."
pubDate: 'Sep 01 2023'
heroImage: '../../assets/hero-personal-blog-with-htmx-go-part-golang-templating.png'
---

This is the first part of the series where I document my journey creating a personal blog using HTMX and Go. This part will cover the basics of Go templating with Labstack Echo.

## Prerequisites

Before we start, make sure you have:
- Go installed (1.21 or later recommended)
- Basic understanding of Go syntax
- A text editor of your choice

## Setting Up the Project

First, let's create a new Go project:

```bash
mkdir my-blog
cd my-blog
go mod init my-blog
```

Next, we'll install Echo, our HTTP framework of choice:

```bash
go get github.com/labstack/echo/v4
```

## Understanding Go Templates

Go's `html/template` package is powerful yet simple. Templates allow us to:
- Separate HTML from Go code
- Inject dynamic data into HTML
- Create reusable components

### Basic Template Syntax

Templates use double curly braces `{{}}` for dynamic content:

```html
{{define "greeting"}}
<h1>Hello, {{.Name}}!</h1>
{{end}}
```

The `.` represents the data passed to the template.

## Creating Our First Template

Create a directory structure:

```
my-blog/
├── main.go
├── public/
│   └── index.html
└── template/
    └── template.go
```

Let's create `public/index.html`:

```html
{{define "index"}}
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>My Blog</title>
</head>
<body>
    <h1>Welcome to {{.Title}}</h1>
    <p>{{.Description}}</p>
</body>
</html>
{{end}}
```

## Setting Up the Template Renderer

Create `template/template.go`:

```go
package template

import (
    "html/template"
    "io"
    "github.com/labstack/echo/v4"
)

type TemplateRenderer struct {
    templates *template.Template
}

func (t *TemplateRenderer) Render(w io.Writer, name string, data interface{}, c echo.Context) error {
    return t.templates.ExecuteTemplate(w, name, data)
}

func NewTemplateRenderer(pattern string) *TemplateRenderer {
    return &TemplateRenderer{
        templates: template.Must(template.ParseGlob(pattern)),
    }
}
```

## Wiring Everything Together

Now let's create our `main.go`:

```go
package main

import (
    "net/http"
    "my-blog/template"
    "github.com/labstack/echo/v4"
)

func main() {
    e := echo.New()

    // Set up template renderer
    e.Renderer = template.NewTemplateRenderer("public/*.html")

    // Define routes
    e.GET("/", func(c echo.Context) error {
        data := map[string]interface{}{
            "Title":       "My Blog",
            "Description": "Welcome to my personal blog built with HTMX and Go!",
        }
        return c.Render(http.StatusOK, "index", data)
    })

    // Start server
    e.Logger.Fatal(e.Start(":4040"))
}
```

## Running the Application

Start the server:

```bash
go run .
```

Visit `http://localhost:4040` and you should see your rendered template!

## Creating Reusable Partials

One of the best features of Go templates is the ability to create partials. Let's create a name card partial:

Create `public/name_card.html`:

```html
{{define "name_card"}}
<div>
    <p>User Personal Information:</p>
    <ol>
        <li>Name: {{.Name}}</li>
        <li>Phone: {{.Phone}}</li>
        <li>Email: {{.Email}}</li>
    </ol>
</div>
{{end}}
```

You can include this in other templates using:

```html
{{template "name_card" .User}}
```

## Introducing HTMX

Now here's where it gets interesting. HTMX allows us to make AJAX requests directly from HTML attributes. Add HTMX to your page:

```html
<script src="https://unpkg.com/htmx.org@1.9.10"></script>
```

Now we can create interactive elements:

```html
<button hx-get="/user-info" hx-target="#user-info" hx-swap="innerHTML">
    Load User Info
</button>
<div id="user-info"></div>
```

When clicked, this button will:
1. Make a GET request to `/user-info`
2. Replace the contents of `#user-info` with the response

## Creating the User Info Endpoint

Add this to your `main.go`:

```go
e.GET("/user-info", func(c echo.Context) error {
    user := map[string]interface{}{
        "Name":  "Wyndham",
        "Phone": "+62-xxx-xxx-xxxx",
        "Email": "business@mwyndham.dev",
    }
    return c.Render(http.StatusOK, "name_card", user)
})
```

## What's Next?

In the next part, we'll integrate TailwindCSS to make our blog look professional. We'll cover:
- Setting up TailwindCSS with Go
- Creating responsive layouts
- Styling our components

Stay tuned!

<u>**#blogging**</u> <u>**#Golang**</u> <u>**#Htmx**</u> <u>**#Tutorial**</u> <u>**#series**</u>
