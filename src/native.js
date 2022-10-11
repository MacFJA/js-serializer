/**
 * @internal
 * @ignore
 * @param {(classname:string,toPlain:(source: any, next: (data: any) => any) => object | undefined,fromPlain:(source: object, next: (data: any) => any) => any | undefined)=>void} addClassHandler
 * @param {(classConstructor:ClassDefinition<any>)=>void} addGlobalAllowedClass
 * @return void
 */
export function addNativeClasses(addClassHandler, addGlobalAllowedClass) {
  addClassHandler(
    "Date",
    (object) => ({ time: object.getTime() }),
    function (object) {
      let date = new Date();
      date.setTime(object.time);
      return date;
    }
  );
  addClassHandler(
    "BigInt",
    (object) => ({ number: object.toString() }),
    (object) => BigInt(object.number)
  );
  addClassHandler(
    "String",
    (object) => ({ text: object.toString() }),
    (object) => new String(object.text)
  );
  addClassHandler(
    "RegExp",
    (object) => ({ source: object.source, flags: object.flags }),
    (object) => new RegExp(object.source, object.flags)
  );
  addClassHandler(
    "Number",
    function (object) {
      let result = {
        nan: false,
        infinity: false,
        positive: true,
        number: null,
      };
      if (Math.abs(object) === Infinity) {
        result["infinity"] = true;
        result["positive"] = Math.abs(object) === object;
        return result;
      }

      if (isNaN(object)) {
        result["nan"] = true;
        return result;
      }

      result["number"] = object.valueOf();
      return result;
    },
    function (object) {
      if (object.nan) return NaN;
      if (object.infinity) {
        return Infinity * (object.positive ? 1 : -1);
      }
      return new Number(object.number);
    }
  );
  addClassHandler(
    "Map",
    (object, next) => ({
      data: Array.from(object.entries()).map((item) => next(item)),
    }),
    function (object, next) {
      const map = new Map();
      object.data
        .map((entry) => next(entry))
        .forEach(([key, value]) => map.set(key, value));
      return map;
    }
  );
  addClassHandler(
    "Set",
    (object, next) => ({
      data: Array.from(object.values()).map((item) => next(item)),
    }),
    function (object, next) {
      const set = new Set();
      object.data
        .map((entry) => next(entry))
        .forEach((value) => set.add(value));
      return set;
    }
  );
  addClassHandler(
    "ArrayBuffer",
    (object, next) => ({ data: next(new Uint8Array(object)) }),
    (object, next) => next(object.data).buffer
  );
  addClassHandler(
    "DataView",
    (object, next) => ({
      buffer: next(object.buffer),
      offset: object.byteOffset,
      length: object.byteLength,
    }),
    (object, next) =>
      new DataView(next(object.buffer), object.offset, object.length)
  );

  [
    Error,
    EvalError,
    RangeError,
    AggregateError,
    ReferenceError,
    SyntaxError,
    TypeError,
    URIError,
    Int8Array,
    Uint8Array,
    Uint8ClampedArray,
    Int16Array,
    Uint16Array,
    Int32Array,
    Uint32Array,
    Float32Array,
    Float64Array,
    BigInt64Array,
    BigUint64Array,
  ].forEach((constructor) => addGlobalAllowedClass(constructor));
}
