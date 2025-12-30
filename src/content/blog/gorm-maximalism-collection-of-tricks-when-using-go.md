---
title: "GORM Maximalism: Collection of Tricks When Using Go ORM"
description: "Six advanced GORM techniques including nested preloading, custom JSONB types, plucking, and reusable query scopes."
pubDate: 'May 20 2024'
heroImage: '../../assets/hero-gorm-maximalism-collection-of-tricks-when-using-go.webp'
---

## Why?

Using GORM for your production code? still querying models one by one like a cave man? tired of yet another repository method that spell `db.Find(&result).Error`? This blogpost is for you. This is the collection of many neat tricks that GORM can do where I seldomly seen being used in the wild.

### Trick 1: Preloading

Imagine you have two models that's related (1-to-many):

```go
type User struct {
  gorm.Model
  Name        string
  Email       string
}

type Report struct {
  gorm.Model
  Score       uint
  UserID      uint
}
```

And you want to fetch user data, but also returning report all at once. Doing it this way is the noob way:

```go

var user User
err := db.Find(&user,1).Error
...
var reports []Report
err := db.Where("user_id = ?", 1).Find(&reports).Error
```

Instead, you can declare that `User` have many `Reports` and having it preloaded immediately:

```go
type User struct {
  gorm.Model
  Name        string
  Email       string
  Reports     []Report
}
...
var user User
err := db.Preload("Reports").Find(&user,1).Error
```

Neat!

### Trick 2: Preloading (But Now With Query)

I would imagine that if a user have hundreds of reports, you don't actually need all of that. Instead, let's imagine you only need last 10 reports ordered by when was the last time it modified. You can instead does this:

```go
var user User
err := db.Preload("Reports", "ORDER BY updated_at DESC LIMIT ?", 10).
  Find(&user).
  Error
```

And you can do any sort of query in this way.

### Trick 3: Preloading (Again) But Nested?!!

We're starting to get to the fun part. Remember our best friend `User` and `Report` above? Now let's imagine that `Report` can have multiple `Attachment`, similarly in one to many relation:

```go
type Report struct {
  ...
  Attachments []Attachment
}

type Attachment struct {
  gorm.Model
  ReportID    uint
  Path.       string
  Metadata    JSONB // hint: this is another trick!
}
```

Again, we want to fetch user data alongside the last 10 reports, but now we want to at least fetch one attachment from each report for thumbnail purposes. And let say we want to return the last created attachment. We can do this instead:

```go
var user User
err := db.Preload("Reports", "ORDER BY updated_at DESC LIMIT ?", 10).
  Preload("Reports.Attachments", "ORDER BY created_at DESC LIMIT 1"). // you can always hardcode any value. The other one is just for example if the value is dynamic.
  Find(&user).
  Error
```

Now the `User` will contains bunch of `Reports` and each `Reports` will contains maximum of 1 `Attachments` each!

```go
var thumbs []string
for i := range user.Reports {
  thumbs = append(thumbs, user.Reports[i].Attachments[0].Path)
}
```

Neat right?!

### Trick 4: Cherry Plucking ??

Imagine that you want to quickly fetch all attachment's path, and have no need for other fields at all.

Very similar to Rails's Active Record, you can `pluck` a database query to only select specific field, and immediately mutate it to its direct data type. For example:

```go
var paths []string
err := db.Model(&Attachment{}).
  Where("report_id = ?", reportID).
  Pluck("path", &paths).
  Error
```

Now you don't need a bunch of `Attachment` entities when all you ever need is an `[]string` or any other data type!

### Trick 5: Using Custom Data Type

Speaking of data type, one of the more useful data type in PostgreSQL (and many others DB for that matter) is `JSONB` or JSON Binary. It has many usefulness such as querying JSON directly in SQL:

```sql
SELECT
  metadata->>"name" AS name,
  metadata->>"status_history"->>0->>"created_at" AS "last_recorded_date"
FROM "service_users";
```

But by default, JSONB type in GORM will be treated as `pgx.JSONB` type that is intrinsically a `[]string`, which is inconvenient to parse and mutate later on.

Instead of that, let's create our own custom data type that's compatible with GORM's API, and instead of string array we will be using `map[string]interface{}` instead:

```go
type JSONB map[string]interface{}

// Called when Marshalling the JSONB
func (m JSONB) Value() (driver.Value, error) {
	return json.Marshal(m)
}

// Called when Unmarshalling the JSONB
func (m *JSONB) Scan(value interface{}) error {
	var mapSrc []byte
	mp := make(map[string]interface{})

    switch v := value.(type) {
    case nil:
		return nil
	case string:
		mapSrc = []byte(v)
    case []uint8:
		mapSrc = v
	default:
		return errors.New("incompatible type!")
	}

	err := json.Unmarshal(mapSrc, &mp)
	if err != nil {
		return errs.Wrap(err)
	}
	*m = mp
	return nil
}
```

Whenever we want to store a JSON format in the DB, no more using `pgx.JSONB` or, worse yet, using `string`. For example:

```go
type Attachment struct {
  gorm.Model
  ReportID    uint
  Path.       string
  Metadata    JSONB
}

// Accessing fields
var attachments []Attachment
err := db.Where("report_id = ?", 10).Find(&attachments).Error
...
date := attachments.Metadata["created_at"]
```

### Trick 6: Scoping Your Expectation

This one is my favourite, but the one that's very hard to fully utilize. You can just batch together some commonly used queries into a scope! Meaning that now every time you use that scope, you'll doing a bunch of queries that usually needs to be applied one by one.

For example, now let's imagine that a `Report` is considered `risky` if every single one of these requirements were met:

- `Score` is less than 60.
- Have zero attachment.
- From a list of high-risk users.

Usually you'll need to construct several different queries like this:

```go
var highRiskID = []uint{1,23,44,69}
...
var hrReports []Reports
err := db.Where("user_id IN (?)", highRiskID).
  Where("score < ?" 60).
  Joins("LEFT OUTER JOIN attachments ON reports.id = attachments.report_id").
  Find(&hrReports).
  Error
```

But the next time you want to query against high risk user, you'll repeat that same queries again. Instead of doing that, you can use `Scope` instead:

```go
func HighRisk(userIDs []uint) func(db *gorm.DB) *gorm.DB {
  return func(db *gorm.DB) *gorm.DB {
    return db.Where("user_id IN (?)", userIDs).
      Where("score < ?" 60).
      Joins("LEFT OUTER JOIN attachments ON reports.id = attachments.report_id")
  }
}
```

And then later you can use it like this:

```go
var highRiskID = []uint{1,23,44,69}
...
var hrReports []Reports
err := db.Scopes(HighRisk(highRiskID)).Find(&hrReports).Error
```

Now we can have reusable queries at our disposal!

And I want to throw some ideas where scope can be very useful. You can use `Scopes` as a way to pass around logic between layers!

For example, if your API endpoint needs some degree of flexibility from user side, you can tied together a `URL Query Params` with scope function:

```go
isHighRisk := c.QueryParams("is_high_risk") == "true"
page, _ := strconv.Atoi(c.QueryParams("page"))
pageSize, _ := strconv.Atoi(c.QueryParams("page_size"))

var scopes []func(*gorm.DB)*gorm.DB{}{}

if (isHighRisk) {
  scopes = append(scopes, HighRisk())
}

if page != 0 && pageSize != 0 {
  scopes = append(scopes,Paginate(page,pageSize))
}

var reports []Report
err := db.WithContext(ctx).Scopes(scopes...).Find(&reports).Error
```

The possibility is endless with this one. Try it yourself and see what sticks!

## Conclusion

With that, I've explained 6 GORM tricks that I personally use a lot in my time code using it. There's still so much more that I haven't had the time to explain (such as multiple database with `database resolver`, `sharding`, `deep insert`, `group`, etc.), so do let me know that you enjoy this article and want me to make part 2!

## Bye! 👋

<u>**#Gorm**</u> <u>**#tricks**</u> <u>**#Golang**</u> <u>**#Tutorial**</u> <u>**#Database**</u>
