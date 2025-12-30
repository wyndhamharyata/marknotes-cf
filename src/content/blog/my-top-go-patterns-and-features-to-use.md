---
title: "My Top Go Patterns and Features to Use"
description: "Five practical Go patterns including contextual primary keys, interface unions, test fixtures, go:embed, and the flag package."
pubDate: 'May 10 2025'
heroImage: '../../assets/hero-my-top-go-patterns-and-features-to-use.webp'
---

Hi there! It's been a while since I last wrote an article on this blog. I think now that I have some more time to kill, let's start making this site a little bit more alive.

To make things easy, let's start with the best 5 practices I do a lot in my day job to make my code either better or more productive. It's not necessarily the best, even in isolation, but these have helped me over the years.

## 1. Primary Key for DB

How do you guys usually set the primary key, for example, in a PostgreSQL table?

```sql
CREATE TABLE IF NOT EXISTS "surveys" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "title" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Random string? UUID? hell, autoincrement number? *Please don't be an autoincrement number*.

For my personal use, my favourite is `string` But it's a combination of context and `uuid`. So, for example, given that the data is to represent `Survey` Let's set our ID as `survey-<<uuid>>`:

```json
{
  "id": "survey-51d42560-fec4-4f55-bf59-be12735482a7",
  "title": "How do you find this blog?",
  "created_at": "Fri, 09 May 2025 11:56:59 GMT"
}
```

This serves as 2 primary reasons:

- **It's guaranteed to be unique** \
  With `uuid` As a key part of the ID, we can guarantee that the ID is unique even in the ultra-distributable environment.
- **It keeps context for you to use** \
  One big major drawback to just using `uuid` without extra flavour is that, given the ID in isolation, you couldn't really tell the difference between an ID for a `Survey` or for a `User`. By keeping the context of the id in the id itself, you can rather easily debug issues in the future.

You can even let it be generated on the DB level as well, just modify the query above to something like this:

```sql
CREATE TABLE IF NOT EXISTS "surveys" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT ('survey-' || uuid_generate_v4()),
  "title" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

## 2. Interface for Union Types

This one is rather fundamental for Go devs, but you'd be surprised how many people don't default to doing what I'm going to explain here.

How do you guys usually define a type that might have multiple interpretations? Let's say if a `Survey` might have multiple `Question` types (Multiple Choice, Free Form, Rating, etc.), and you wanted to represent it as a domain model.

You can do something like carrying dynamic maps or having one big struct that can represent all:

```go
// dynamic maps for you guys that loves wild west
type Survey struct {
  ID        string
  Questions []map[string]interface{}
}

// or maybe some semblance of structure...
type Question struct {
  ID        string
  Text      string
  Choices   []Choice
  Type      string
  MinRating string
  MaxRating string
  Step      int
  ...
}
```

Or, IMO, the better way is to leverage `interface` :

```go
type Survey struct {
  ID        string
  Questions []Question
}

// This is a common interface that could have multiple implementations
type Question interface {
  IsQuestion()
}

type FreeForm struct {
  ID    string
  Text  string
}

// Adding this ensures that FreeForm implements Question interface
func (FreeForm) IsQuestion() {}
```

This way, you can fit both `FreeForm` to an array of `Question` interface as both do implement its interface methods. You can define other structs, of course, and as long as they implement `isQuestion()` method to satisfy `Question` interface, you're Gucci.

You can even make use of it for defining common functionalities like this:

```go
// Using interface method
type Question interface {
  IsQuestion()
  GetId() string
  GetType() string
}

func (v FreeForm) GetId() string {
  return v.ID
}

func (v FreeForm) GetType() string {
  return "FREE_FORM"
}
```

Or even restrict the usage of a generic-type function like this:

```go
// This ensures that even though T could be any interface type,
// it has to implements Question interface.
func InsertQuestion[T Question](
	ctx context.Context,
	tx *bun.Tx,
	surveyId string,
	question T,
) error {
	_, err := tx.NewInsert().Model(&question).Exec(ctx)
	if err != nil {
		return err
	}

	ref := SurveyQuestionRef{
		SurveyId:   surveyId,
         // Now we can access Question specific method.
		QuestionId: question.GetId(),
		QuestionType: question.GetType(),
	}

	_, err = tx.NewInsert().Model(&ref).Exec(ctx)
	if err != nil {
		return err
	}

	return nil
}
```

## 3. Fixtures in Testing

One of the more annoying things when making a test is preparing the initial data needed, especially if you're testing a function that has a lot of validation:

```go
func (s *ServiceSuite) TestCreate() {
  s.Run("Should return error given empty title", func() {
    // You need to do this again.. and again...
    survey := Survey {
       ID:        fmt.Sprintf("%s-%s", "survey", uuid.New()),
       Title:     "",
       Questions: []Question{FreeForm{}},
       ...
    }

    err := s.Service.Create(context.Background(), &survey)
    s.Require().Equal(ErrTitleEmpty, err)
  })

  s.Run("Should return error given 0 question length", func() {
    // And again.. and again.. on every test cases.
    survey := Survey {
      ID:        fmt.Sprintf("%s-%s", "survey", uuid.New()),
      Title:     "Survey Title Testing",
      Questions: []Question{},
      ...
    }

    err := s.Service.Create(context.Background(), &survey)
    s.Require().Equal(ErrQuestionEmpty, err)
  })
}
```

One of my favourite patterns to solve this issue here is introducing fixtures:

```go
// This will be the default / basis survey that all test cases based on.
// Should be as complete and thorough example as possible.
var defaultSurvey = Survey {
  ID: fmt.Sprintf("%s-%s", "survey", uuid.New()),
  Title: "What do you think of our new design?",
  Question: []Question{
    FreeForm{ ... },
    Rating { ... },
    ...
   },
}

// This method is used to create a default survey,
// but with the ability to modify the value to trigger test cases.
func SurveyWith(mod *func(*Survey)) Survey {
  s := defaultSurvey
  if mod != nil {
    mod(&s)
  }

  return s
}
```

Using this pattern, now we're freed from having to create a new value of survey every time we pass through a test case and can focus on what should be different to trigger the condition needed:

```go
func (s *ServiceSuite) TestCreate() {
  s.Run("Should return error given empty title", func() {
    // Now we can just call SurveyWith() and just modify the title.
    survey := SurveyWith(func(s *Survey) { s.Title = "" })

    err := s.Service.Create(context.Background(), &survey)
    s.Require().Equal(ErrTitleEmpty, err)
  })

  s.Run("Should return error given 0 question length", func() {
    // And again here where we just modify the questions.
    survey := SurveyWith(func(s *Survey) { s.Questions = []Question{}})

    err := s.Service.Create(context.Background(), &survey)
    s.Require().Equal(ErrQuestionEmpty, err)
  })
}
```

## 4. Go Embed

One of the Go features that I rarely saw being used, even though it's incredibly useful.

Go embed is a way for us to literally "embed" any binary data (images, CSVs, assets, files) into the Go program itself, freeing us of having to make our own distribution method for additional files needed outside the program.

How to do it? It's incredibly simple. First, you need to make sure that the assets you wanted to embed were accessible relative to the location of the go file it was trying to embed:

```
- main.go
- /asset_manager
  - asset.go -- where we say go embed
  - /assets
    - /images -- we wanted to embed all *.jpeg files here
      - image_1.jpeg
      - image_2.jpeg
      - unrelated_file.txt -- but skip this unrelated file
```

Next, we declare a variable called `images` That represents a File System, a.k.a. folder:

```go
package asset_manager

const IMAGE_PATH = "assets/images"

//go:embed assets/images/*.jpeg
var images embed.FS // ^ the *.jpeg above ensures that we only embed jpeg
...
```

With the `//go:embed` directives, we tell the program to embed the files that match the pattern we provide (`assets/images/*.jpeg`). In this example, all JPEG files under `assets/images`.

That's it! Now, to give an example of how to use the FS, let's try to parse all JPEG images and translate them to an array of `image.Image`:

```go
...

func GetAllImages() ([]image.Image, error) {
	var result []image.Image

	entries, err := images.ReadDir(IMAGE_PATH)
	if err != nil {
		return nil, err
	}

	for _, entry := range entries {
		name := entry.Name()

         // Because we already declare that we only wanted to embed jpeg files
         // We can skip a lot of codes to validate whether
         // we actually processing image or something else
         // Example:
         // if entry.IsDir() {
		//	 continue
		// }

		file, err := images.Open(fmt.Sprintf("%s/%s", IMAGE_PATH, name))
		if err != nil {
			log.Printf("Failed to open %s: %v", name, err)
			continue
		}
		defer file.Close()

		img, _, err := image.Decode(file)
		if err != nil {
			log.Printf("Failed to decode %s: %v", name, err)
			continue
		}

		result = append(result, img)
	}

	return result, nil
}
```

## 5. `flag` Package

Not necessarily underutilized, but most folks often choose something like `goenv` Or other secret / environment variable solution that might be overkill, especially if you just wanted to create a one-time program or client side program which we can't expect to set an env.

But just in case you're new to Go, what is `flag` And what does it do?

Simply, it's a way to provide customizable values that your program could capture at runtime (similar to environment variables), but this time directly on your run command:

```shell
./your_program --secret "SOME SECRET KEY"
```

`flag` Provide a way for us to capture that `"SOME SECRET KEY"` value into the program, and also provides a fallback and description.

How to use it? Again, like all things Go, it's super simple:

```go
var secretKey = flag.String("secret", "DEFAULT_VALUE", "Flag's Description")
```

That's it? Yes! That's it. Now you use the value directly, just like any other `var`:

```go
// This will be a *string instead of string
var secretKey = flag.String("secret", "DEFAULT_VALUE", "Flag's Description")
//                           ^Key      ^Default Value   ^Description

func main() {
    // Don't forget to call this so that the
    // flag actually parsed on runtime,
    // otherwise it'll just return default instead.
    flag.Parse()

    service, err := some_service.NewService(context.Background(), *secretKey)
    if err != nil {
      panic(err)
    }
}
```

`flag` Also automatically generates a help command for your program, which details all the descriptions for each flag available to the program, like this:

```shell
./your_program -h
Usage of ./your_program:
  -secretKey string
        Flag's Description (default "DEFAULT_VALUE")
```

## Conclusion

That's 5 patterns / features down! What do you guys think? Do you think it's useful? too basic? Let me know if you have other tips and tricks that might be useful even for me!

Hit me up through [email](mailto:business@mwyndham.dev), LinkedIn (<https://www.linkedin.com/in/mwyndham>), or my Twitter / X account (@muhwyndam).

Thanks for reading!

<u>**#Golang**</u> <u>**#TipsAndTrick**</u> <u>**#Go**</u>
