ref-union
==========
### Create ABI-compliant "union" instances on top of Buffers

This module offers a "union" implementation on top of Node.js Buffers
using the ref "type" interface.

Installation
------------

Clone from the git repository, not available via NPM while unstable.

Examples
--------

Say you wanted to emulate this fictional struct:

``` c
struct my_data {
  int type;
  union {
    int a;
    char *b;
    float c;
  } data;
};
```

``` js
var ref = require('ref')
var StructType = require('ref-struct')
var UnionType = require('ref-union')

// define the union type
var union_type = UnionType({
  a: ref.types.int,
  b: ref.refType(ref.types.CString),
  c: ref.types.float
})

// define the "my_data" struct type
var my_data = StructType({
  type: ref.types.int,
  u: union_type
})

// now we can create instances of it
var d = new my_data
```

#### With `node-ffi`

This gets very powerful when combined with `node-ffi` to invoke C functions:

``` js
var ffi = require('ffi')

var d = new my_data
some_function(d.ref(), null)
```


License
-------

(The MIT License)

Copyright (c) 2012 Adam Malcontenti-Wilson &lt;adman.cm@gmail.com&gt;
Copyright (c) 2012 Nathan Rajlich &lt;nathan@tootallnate.net&gt;

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
'Software'), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
