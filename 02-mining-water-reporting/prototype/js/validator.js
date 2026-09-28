/* Minimal JSON-Schema (2020-12 subset) validator for the offline prototype.
   Supports: type, const, enum, required, properties, items, minItems, minimum,
   maximum, minLength, pattern, anyOf, allOf, if/then. The Python validator
   (data/validate.py, full jsonschema) is the reference implementation. */
(function () {
  function typeOf(v) {
    if (v === null) return 'null';
    if (Array.isArray(v)) return 'array';
    if (typeof v === 'number') return Number.isInteger(v) ? 'integer' : 'number';
    return typeof v;
  }
  function typeOk(t, v) {
    var a = typeOf(v);
    if (t === 'number') return a === 'number' || a === 'integer';
    return a === t;
  }
  function label(s, path) {
    return (s && s.title) || path.split('/').pop() || 'record';
  }
  function validate(schema, value, path, errors) {
    path = path || '';
    errors = errors || [];
    if (!schema) return errors;
    if (schema.allOf) schema.allOf.forEach(function (s) { validate(s, value, path, errors); });
    if (schema['if'] && schema.then) {
      if (validate(schema['if'], value, path, []).length === 0) validate(schema.then, value, path, errors);
    }
    if (schema.anyOf) {
      var ok = schema.anyOf.some(function (s) { return validate(s, value, path, []).length === 0; });
      if (!ok) {
        var alts = schema.anyOf.map(function (s) { return (s.required || []).join(' + '); }).join(' OR ');
        errors.push({ path: path, msg: 'Provide at least one of: ' + alts });
      }
    }
    if (value === undefined) return errors;
    if ('const' in schema && value !== schema['const']) errors.push({ path: path, msg: 'Must equal ' + JSON.stringify(schema['const']) });
    if (schema['enum'] && schema['enum'].indexOf(value) < 0) errors.push({ path: path, msg: label(schema, path) + ': not an allowed value' });
    if (schema.type && !typeOk(schema.type, value)) {
      errors.push({ path: path, msg: label(schema, path) + ': expected ' + schema.type });
      return errors;
    }
    var t = typeOf(value);
    if (t === 'number' || t === 'integer') {
      if (schema.minimum !== undefined && value < schema.minimum) errors.push({ path: path, msg: label(schema, path) + ': must be >= ' + schema.minimum });
      if (schema.maximum !== undefined && value > schema.maximum) errors.push({ path: path, msg: label(schema, path) + ': must be <= ' + schema.maximum });
    }
    if (t === 'string') {
      if (schema.minLength && value.length < schema.minLength) errors.push({ path: path, msg: label(schema, path) + ': too short' });
      if (schema.pattern && !(new RegExp(schema.pattern)).test(value)) errors.push({ path: path, msg: label(schema, path) + ': format ' + schema.pattern });
    }
    if (t === 'object') {
      (schema.required || []).forEach(function (k) {
        if (value[k] === undefined || value[k] === '' || value[k] === null) {
          var sub = schema.properties && schema.properties[k];
          errors.push({ path: path + '/' + k, msg: 'Required: ' + label(sub, path + '/' + k), required: true });
        }
      });
      if (schema.properties) {
        Object.keys(schema.properties).forEach(function (k) {
          if (value[k] !== undefined) validate(schema.properties[k], value[k], path + '/' + k, errors);
        });
      }
    }
    if (t === 'array') {
      if (schema.minItems && value.length < schema.minItems) errors.push({ path: path, msg: label(schema, path) + ': at least ' + schema.minItems + ' item(s)', required: true });
      if (schema.items) value.forEach(function (v, i) { validate(schema.items, v, path + '/' + i, errors); });
    }
    return errors;
  }
  window.MWPValidator = { validate: function (schema, value) { return validate(schema, value, '', []); } };
})();
