---
title: "I Find it Hard to Reuse Root Template in Go"
description: "A solution to the challenge of reusing parent templates in Go's html/template when building HTMX applications with partial and page rendering."
pubDate: 'Sep 15 2023'
heroImage: '../../assets/hero-i-find-it-hard-to-reuse-root-template.jpg'
---

This blogpost is part of my documentation for my journey in implementing HTMX using Go for my personal Blog.

HTMX has a very good integration with Golang, but that does not mean  that everything is a rose and rainbow. This blogpost will show you one  area where vanilla Go Template is lacking when it comes to integrating  with HTMX: the `partial` vs `page`.

> Before we continue, please be mind that I am exploring this on my  own. So if what I found here is basically a non-issue (like there are  more obvious solution) or I just jumped the shark with my gung-ho  solution, then please tell me about it! Thanks!

## The `hx-push-url` Scenario

Let's imagine you have a `index` page that has button to navigate to a `content`. You're using `hx-get` to transition to that `content`. Now if the user chooses to refresh the page, you will be back to the `index` without the `content` part of the page.

Let's assume you do not want that because it will be a bad user  experience. You want if user refresh the page, they will be still in the  `content` part of the UI.

HTMX gives us helpful tools such as `hx-push-url` to push our `hx-get` url towards browser history. Now, even if user refresh the page, it will still accessing the `content` part of the view. But now you have bigger problem.

Let's see what's inside `index` page:

```
<!DOCTYPE html>
<html lang="en">
<head>
    ...
</head>
<body id="root-body">
    <p>This is Index body</p>
    <button hx-get="/content" hx-target="#root-body" hx-push-url="true">
        Navigate to Content
    </button>
</body>
</html>
```

And then let's see what's inside `content` part:

```
<p>This is content body</p>
<button hx-get="/" hx-target="#root-body" hx-push-url="true">
    Back to index
</button>
```

We immediately see that `content` does not looks as complete as `index`. It was not a valid HTML, it lacks head, it lacks body, etc. Which is understable, as we want `content` as some sort of partials that can be cheaply sent towards the user.

But now because we push the `url`  towards browser history, we let user access this incomplete partials.  Whenever user refreshes the page (in this example is whenever user  access the `/content` url), they will be greeted with incomplete page that only consist of the partials we push previously.

We can solve this by checking whether the request was triggered by  HTMX or not. If it was sent by HTMX, let's send a partials, and if it  was not triggered by HTMX, let's send a full page with the partials  inside it.

To see whether a request were triggered by HTMX, we could just check whether `HX-Request` header exist or not. Easy.

But the bigger problem is how will we provide the templates for each scenario.

## Duplicates of Templates

Now, how do we provide two different-but-same template in which ones  would be composed as a page but the other just as a partial? Golang  templating has one weakness: **reusing top-level component in nested scenario**. It is rather easy in Go to compose bigger component from smaller ones:

```
<!-- Imagine this is a skeleton of a page -->
{{define "page"}}
	<div>
		{{template "top" .}}
	</div>
	<div>
		{{template "right" .}}
	</div>
	<div>
		{{template "bottom" .}}
	</div>
	<div>
		{{template "left" .}}
	</div>
{{end}}
```

But whenever we need to reuse components in from the outer layer of the template, says, the `<html>` tag and `<header>`  where it wraps around another component like this:

```
<!-- How do we reuse this whole html-->
<!DOCTYPE html>
<html lang="en">
	<head>
	    ...
	</head>
	<body id="root-body">
	<!-- but allows to add any template here? -->
	{{template "content" .}}
	</body>
</html>
```

It will starts to be very hard very quickly.  How do we reuse a parent component with customizable inner components?

One possible way to work around this issue is to provide 2 different template. For example, let say we have `content.html` and `content_page.html` to represent partial and page respectively.

For example `content.html`:

```
<!-- content.html-->
{{define "content"}}
	<p>This is content body</p>
	<button hx-get="/" hx-target="#root-body" hx-push-url="true">
	   Back to index
	</button>
{{end}}
```

And for the `content_page.html`:

```
{{define "content_page"}}
<!DOCTYPE html>
<html lang="en">
	<head>
	    ...
	</head>
	<body id="root-body">
		{{template "content" .}}
	</body>
</html>
{{end}}
```

And this is how it will looks in the file system:

```dirtree
- /page
	- content.html
	- content_page.html
	- index.html
	- index_page.html
- /component
	- head_tags.html
	- header.html
	- footer.html
```

You can immediately see the issues with this approach. **First**,  we will always need to have duplicates of templates. Even if we're  extracting as much component from the template as possible, the minimum  each `*_page.html` could look like:

```
{{define "content_page"}}
<!DOCTYPE html>
<html lang="en">
	<head>
	    {{template "head_tags" .}}
	</head>
	<body id="root-body">
		{{template "content" .}}
	</body>
</html>
{{end}}
```

Or even something ugly like this:

```
{{define "content_page"}}
<!-- including DOCTYPE and html definition -->
{{template "upper_page" .}}
<body id="root-body">
	{{template "content" .}}
</body>
<!-- including the closing tags for html -->
{{template "lower_page" .}}
{{end}}
```

Where we require 2 different templates to always be in pair (see `upper_page` and `lower_page` template).

**Secondly**, we will need to keep track of 2 different  file all the time, both the non page and the page ones, all while  requires us to specify which ones to render each time we know it should  be rendered as a page. This is tedious and error prone!

Another solution is to pass the raw html as a string value and use it as a template params, something like this:

```
body := `
<p>This is content body</p>
	<button hx-get="/" hx-target="#root-body" hx-push-url="true">
	   Back to index
	</button>
`
```

```
// Then in go code
template.ExecuteTemplate(w, "index", body)
```

But this cause so much more issue, like  having either HTML directly in go page or somehow you need to manually  parse HTML without using template tools, it's an unsustainable work  around IMHO.

But then how do we  solve it? should we go all the way using  templating tools/framework such as TempL, Hugo, etc? Well, not quite as  this is actually a solved issue but the solution is a bit unexpected (at  least for me).

## (Obviously) You can have more than 1 template!

Turns out Go do provide some sort of solution to this, but not in the way that you might expect.

So, if we're looking at most of the `template` examples out there in the web, most of the time they will always show you only 1 instance of `template.Template`. For example:

```go
...
td := Todo{"Test templates", "Let's test a template to see the magic."}
t, err := template.New("todos").Parse("You have a task named \"{{ .Name}}\" with description: \"{{ .Description}}\"")
...
```

The code above was taken directly from [GopherAcademy's tutorial on Template](https://blog.gopheracademy.com/advent-2017/using-go-templates/). And they're not alone in this, [Labstack's Echo's own guide on using template is only using 1 instance of template](https://echo.labstack.com/docs/templates).  It is not wrong per se to do this as it shows the example on using  template. But if you think about it, you realize that there is nothing  stopping you to have more than 1 instance of `template.Template`!

Now let's imagine instead of just having 1 `template.Template` instance, we have a `map[string]*template.Template` instead, and we're composing each page as it's own template, mapped!

But how does this solve the problem exactly? well, **the definition of a template is only relevant to what other component available during the parsing**.

It does not care if there is multiple instance of the same definition  as long as they does not parsed into 1 template at the same time. So  for example we can have as much as `{{define "body"}}` definition as possible, as long as during `ParseFiles`, we only include one of those.

Now with that knowledge, we know we could have 1 template each to  represent a single page, we can realistically have this (let's say this  is `root.html`):

```
{{define "root"}}
<!DOCTYPE html>
<html lang="en">
	<head>
	    ...
	    {{template "head" .}}
	</head>
	<body id="root-body">
	    {{template "body" .}}
	</body>
</html>
{{end}}
```

Which should represent our "root" structure. Now we can try to represent the index page, let say we name it `index.html`:

```
<!-- This will render to the "head" section of the root -->
{{define "head"}}
	<title>Page Index</title>
{{end}}
<!-- This will render to the "body" section of the root,
and we assume this is the partials.-->
{{define "body"}}
	<p>This is Index body</p>
	<button hx-get="/content" hx-target="#root-body" hx-push-url="true">
	    Navigate to Content
	</button>
{{end}}
```

And this is also how we represent the `content.html`:

```
<!-- content.html-->
{{define "head"}}
	<title>Page Content</title>
{{end}}
{{define "body"}}
	<p>This is content body</p>
	<button hx-get="/" hx-target="#root-body" hx-push-url="true">
	    Back to index
	</button>
{{end}}
```

Now we can try to reuse our `root.html` files whener we parse the files during the template initiation:

```go
tmpIndex := &template.Template{}
template.Must(tmp.ParseFiles("/path/to/root.html", "/path/to/index.html"))
templates["index"] = tmpIndex
...
tmpContent := &template.Template{}
template.Must(tmp.ParseFiles("/path/to/root.html", "/path/to/content.html"))
templates["content"] = tmpContent
```

**And Voila!** we're basically reused the root component into each of the template instance. Now we can simply selectively render either the `root` or the partial component (in this example the `body` template):

```
// to render the page
templates["index"].ExecuteTemplate(w, "root", nil)
//to render the partial
templates["index"].ExecuteTemplate(w, "body", nil)
```

## Generalizing the Solution and Wrap It as a Library

The solution above seems easy but managing templates for each page  can be a bit of a mess. This does not include repeat task where you need  to supply the components needed to compose the partial in the first  place (if you decided to do micro-components as such):

```
template.Must(tmp.ParseFiles("/path/to/root.html", "/path/to/index.html", "/path/to/other/components.html"...)) // This is repeating task.
```

Hence I made this simple library which you can find [here](https://github.com/muhwyndhamhp/tmax).  This library does 4 things:

- scan recursively through every subdirectory of component, and append them to every template during parsing files.
- map every specified page partials as it's own separate template instance
- render the correct UI from simple pattern (you can do `"root#index"` to render a page or just `"index"` for partials for example)
- provide common interface for framework (***currently only for Labsctack Echo***).

How to use it? first you can pull my library:

```
go get github.com/muhwyndhamhp/tmax
```

Then, you can attach the template renderer to echo instance:

```
// This is the interface to initiate template renderer (currently only for labstack echo)

func NewEchoTemplateRenderer(e *echo.Echo, rootName, viewName, componentPath string, viewPaths ...string) error

// Example of implementation
err := tmax.NewEchoTemplateRenderer(e, "root", "body", "public/components", "public/views",...)
if err != nil {
	panic(err)
}
```

Each and every function parameters described:

- `rootName` -> the definition of the root componenet (eg. "`root`")
- `viewName` -> the definition of the partial component (eg. "`body`")
- `componentPath` -> the parent path that contains all of the "`*.html`" templates (except the `partial` components which needs to be in separate directory)
- `viewPaths` -> variadic value  where you can pass all of the partial component, it will scan  recursively but you can pass each component individually if you wanted  it.

Then whenever you want to render , you can do it this way:

```
func main() {
	e := echo.New()
	...
	e.GET("/", func(c echo.Context) error {
		if isHXRequest(c) {
			// This will render partial
			return c.Render(http.StatusOK, "index", nil)
		} else {
			// This will render page
			return c.Render(http.StatusOK, "root#index", nil)
		}
	})
...
}

// This is function to see whether the request comes from HTMX or not
func isHXRequest(c echo.Context) bool {
	...
}
```

And I would assume this is how you would manage the template directory structure:

```dirtree
- /public // it does not have to be public, can be any directory
	- /views // where you put the partials
	- /components
		- root.html // you don't have to put it here, any sub directory inside the component folder will do.
		- /atomic
			- search.html
			- text-area.html
			- ...
		- ... any template html file or directory you want
```

That's it!

## Final Words

That's my journey in solving the issue about reusing root structure  in a Go Template project. This solution does not necessarily required  you to use HTMX but I find the usecase while building something using  it.

What do you think? is it helpful? is it good? or is it unnecessary and I jump the shark by doing things this way?

Let me know what you think!

<u>**#Templating**</u> <u>**#Golang**</u> <u>**#Html/Template**</u> <u>**#tricks**</u> <u>**#tips**</u>
