# Helpue

support vue/js/jsx/ts/tsx development

## goDef

pick all `valid` definition in vue component.

including

-   vue options config(`props`, `data`, `setup` and others)
-   template definition(`ref in vue2`, `v-for`, `slot-scope`, `v-slot`)
-   class and identifiers definition in style tag

## Document Here

remake from `Document This` ([Click to Go](https://github.com/oouo-diogo-perdigao/vscode-docthis)) and support more config.

### `>> what to do && usage <<`

this content is made for generate JSDOC for js/jsx/ts/tsx/vue file

`'ctrl+alt+d ctrl+alt+d'` or complete item `'/**'`

### helpue.documentHere.hideHeaderDescription

`default: false`

When enabled, '@description' tag at JsDoc header will be hidden

### helpue.documentHere.authorName

the `@author` content, if not set, it will be `git config user.name` or `unknown`

### helpue.documentHere.dateFormat

`default: YYYY-MM-DD`

depending on `dayjs`

### helpue.documentHere.defaultParamName

`default: param`

auto generated params name for methods params

### helpue.documentHere.classDocContent

```json
"supported": [
	"description",
	"class",
	"heritage",
	"template",
	"author",
	"date"
]
```

### helpue.documentHere.classConstructorDocContent

```json
"supported": [
	"description",
	"author",
	"date",
	"param",
	"memberof"
]
```

### helpue.documentHere.InterfaceDocContent

```json
"supported": [
	"description",
	"interface",
	"heritage",
	"template",
	"author",
	"date"
]
```

### helpue.documentHere.EnumDocContent

```json
"supported": [
	"description",
	"enum",
	"author",
	"date"
]
```

### helpue.documentHere.FunctionAndMethodsDocContent

```json
"supported": [
	"description",
	"function",
	"author",
	"date",
	"template",
	"param",
	"returns"
]
```
