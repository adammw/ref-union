
/**
 * An interface for modeling and instantiating C-style data structures. This is
 * not a constructor per-say, but a constructor generator. It takes an array of
 * tuples, the left side being the type, and the right side being a field name.
 * The order should be the same order it would appear in the C-style union
 * definition. It returns a function that can be used to construct an object that
 * reads and writes to the union using properties specified by the
 * initial field list.
 *
 * The only verboten field names are "ref", which is used used on union
 * instances as a function to retrieve the backing Buffer instance of the
 * union, and "_pointer" which contains the backing Buffer instance.
 *
 */

var ref = require('ref')
var assert = require('assert')
var debug = require('debug')('ref:union')


/**
 * The Union "type" meta-constructor.
 */

function Union () {
  debug('defining new union "type"')

  /**
   * This is the "constructor" of the Union type that gets returned.
   *
   * Invoke it with `new` to create a new Buffer instance backing the struct.
   * Pass it an existing Buffer instance to use that as the backing buffer.
   * Pass in an Object containing the struct fields to auto-populate the
   * struct with the data.
   */

  function UnionType (arg, data) {
    if (!(this instanceof UnionType)) {
      return new UnionType(arg, data)
    }
    debug('creating new union instance')
    var store
    if (Buffer.isBuffer(arg)) {
      debug('using passed-in Buffer instance to back the union', arg)
      assert(arg.length >= UnionType.size, 'Buffer instance must be at least '
          + UnionType.size + ' bytes to back this union type')
      store = arg
      arg = data
    } else {
      debug('creating new Buffer instance to back the union (size: %d)', UnionType.size)
      store = new Buffer(UnionType.size)
    }

    // set the backing Buffer store
    store.type = UnionType
    this._pointer = store

    if (arg) {
      for (var key in arg) {
        // hopefully hit the struct setters
        this[key] = arg[key]
      }
    }
    UnionType._instanceCreated = true
  }

  // make instances inherit from the `proto`
  UnionType.prototype = Object.create(proto, {
    constructor: {
        value: UnionType
      , enumerable: false
      , writable: true
      , configurable: true
    }
  })

  UnionType.defineProperty = defineProperty
  UnionType.toString = toString
  UnionType.fields = {}

  // Setup the ref "type" interface. The constructor doubles as the "type" object
  UnionType.size = 0
  UnionType.alignment = 0
  UnionType.indirection = 1
  UnionType.get = get
  UnionType.set = set

  // Read the fields list and apply all the fields to the struct
  // TODO: Better arg handling... (maybe look at ES6 binary data API?)
  var arg = arguments[0]
  if (Array.isArray(arg)) {
    // legacy API
    arg.forEach(function (a) {
      var type = a[0]
      var name = a[1]
      UnionType.defineProperty(name, type)
    })
  } else if (typeof arg === 'object') {
    Object.keys(arg).forEach(function (name) {
      var type = arg[name]
      UnionType.defineProperty(name, type)
    })
  }

  return UnionType
}
module.exports = Union

/**
 * The "get" function of the Union "type" interface
 */

function get (buffer, offset) {
  debug('Union "type" getter for buffer at offset', buffer, offset)
  if (offset > 0) {
    buffer = buffer.slice(offset)
  }
  return new this(buffer)
}

/**
 * The "set" function of the Union "type" interface
 */

function set (buffer, offset, value) {
  debug('Union "type" setter for buffer at offset', buffer, offset, value)
  if (offset > 0) {
    buffer = buffer.slice(offset)
  }
  var union = new this(buffer)
  var isUnion = value instanceof this
  if (isUnion) {
    // TODO: optimize - use Buffer#copy()
    Object.keys(this.fields).forEach(function (name) {
      // hopefully hit the setters
      union[name] = value[name]
    })
  } else {
    for (var name in value) {
      // hopefully hit the setters
      union[name] = value[name]
    }
  }
}

/**
 * Custom `toString()` override for union type instances.
 */

function toString () {
  return 'UnionType'
}

/**
 * Adds a new field to the union instance with the given name and type.
 * Note that this function will throw an Error if any instances of the union
 * type have already been created, therefore this function must be called at the
 * beginning, before any instances are created.
 */

function defineProperty (name, type) {
  debug('defining new union type field', name)

  // allow string types for convenience
  type = ref.coerceType(type)

  assert(!this._instanceCreated, 'an instance of this Union type has already '
      + 'been created, cannot add new "fields" anymore')
  assert.equal('string', typeof name, 'expected a "string" field name')
  assert(type && /object|function/i.test(typeof type) && 'size' in type &&
      'indirection' in type
      , 'expected a "type" object describing the field type: "' + type + '"')
  assert(!(name in this.prototype), 'the field "' + name
      + '" already exists in this Union type')

  // define the getter/setter property
  Object.defineProperty(this.prototype, name, {
      enumerable: true
    , configurable: true
    , get: get
    , set: set
  });

  var field = {
    type: type
  }
  this.fields[name] = field

  // calculate the new size and field offsets
  recalc(this)

  function get () {
    debug('getting "%s" union field (offset: %d)', name, field.offset)
    return ref.get(this._pointer, field.offset, type)
  }

  function set (value) {
    debug('setting "%s" union field (offset: %d)', name, field.offset, value)
    return ref.set(this._pointer, field.offset, value, type)
  }
}

function recalc (union) {

  // reset size and alignment
  union.size = 0
  union.alignment = 0

  var fieldNames = Object.keys(union.fields)

  // first loop through is to determine the `alignment` of this union
  fieldNames.forEach(function (name) {
    var field = union.fields[name]
    var type = field.type
    var alignment = type.alignment || ref.alignof.pointer
    if (type.indirection > 1) {
      alignment = ref.alignof.pointer
    }
    union.alignment = Math.max(union.alignment, alignment)
  })

  // second loop through sets the `offset` property on each "field"
  // object, and sets the `union.size` as we go along
  fieldNames.forEach(function (name) {
    var field = union.fields[name]
    var type = field.type

    var size = type.indirection === 1 ? type.size : ref.sizeof.pointer

    union.size = Math.max(union.size, size)

    field.offset = 0
  })

  // any final padding?
  var left = union.size % union.alignment
  if (left > 0) {
    debug('additional padding to the end of union:', union.alignment - left)
    union.size += union.alignment - left
  }
}

/**
 * this is the custom prototype of Union type instances.
 */

var proto = {}

/**
 * set a placeholder variable on the prototype so that defineProperty() will
 * throw an error if you try to define a union field with the name "_pointer".
 */

proto._pointer = ref.NULL

/**
 * returns a Buffer pointing to this union data structure.
 */

proto.ref = function ref () {
  return this._pointer
}
