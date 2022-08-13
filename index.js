import { addNativeClasses } from "./src/native.js";

/**
 * @typedef {string | number | boolean | object | any[]} PlainType
 */

/**
 * List of constructor to use for data extraction
 * @type {Record<string, FunctionConstructor>}
 */
let globalClasses = {};
/**
 * List of constructor found during serialization
 * @type {FunctionConstructor[]}
 */
let collectedClasses = [];
/**
 * List of special class handler.
 * It allowed to define a custom serializer/deserializer for a class.
 *
 * Used, for example, to handle Javascript native classes
 * @type {Record<string, {fromPlain: (source: object, next: (data: any) => any) => any | undefined, toPlain: (source: any, next: (data: any) => PlainType) => object | undefined}>}
 */
const classHandlers = {};

const CONSTRUCTOR_KEY = "#$@__constructor__";
const INSTANCE_PREFIX = "#$@__instance__";
const REFERENCE_PREFIX = "#$@__reference__";

/**
 * Serialized a data into a string.
 * @param {any} data
 * @returns {string} The serialized data
 */
export function serialize(data) {
  if (typeof data === "undefined") {
    return "undefined";
  }

  return JSON.stringify(instanceToPlain(data, []));
}

/**
 * Deserialize a string
 * @param {string} text
 * @param {Record<string,FunctionConstructor>} [allowedClasses] List of allowed classes for deserialization. It will be merged with the global allowed class list
 * @returns {*}
 */
export function deserialize(text, allowedClasses) {
  if (allowedClasses === undefined) {
    allowedClasses = {};
  }
  if (text === "undefined") {
    return undefined;
  }

  allowedClasses = Object.fromEntries([
    ...Object.entries(allowedClasses),
    ...Object.entries(globalClasses),
  ]);

  const parsed = JSON.parse(text);
  return plainToInstance(parsed, allowedClasses, {});
}

/**
 * Unit of work to transform any data into a plain javascript object or a primitive.
 * @param {any} data
 * @param {Array<any>} observed
 * @returns {PlainType}
 */
function instanceToPlain(data, observed) {
  if (
    typeof data === "string" ||
    (typeof data === "number" && !isNaN(data) && Math.abs(data) !== Infinity) ||
    data === null ||
    data === undefined ||
    typeof data === "boolean"
  ) {
    return data;
  }

  const found = observed.indexOf(data);

  if (found !== -1) {
    return INSTANCE_PREFIX + found;
  }

  observed.push(data);

  if (data.constructor === Array) {
    let newArray = data.map((item) => instanceToPlain(item, observed));
    newArray.unshift(REFERENCE_PREFIX + (observed.length - 1));
    return newArray;
  }

  if (data.constructor === Object) {
    let newObject = Object.fromEntries(
      Object.entries(data).map(([key, value]) => [
        key,
        instanceToPlain(value, observed),
      ])
    );
    newObject[REFERENCE_PREFIX] = observed.length - 1;
    return newObject;
  }

  collectedClasses.push(data.constructor);
  let final = {};
  final = Object.defineProperty(final, CONSTRUCTOR_KEY, {
    value: data.constructor.name,
    enumerable: true,
  });
  final = Object.defineProperty(final, REFERENCE_PREFIX, {
    value: observed.length - 1,
    enumerable: true,
  });

  const handled = handleSpecialToPlain(data, observed);
  if (handled !== undefined) {
    return { ...handled, ...final };
  }
  const props = Object.getOwnPropertyNames(data);
  props.forEach((key) => {
    Object.defineProperty(final, key, {
      value: instanceToPlain(data[key], observed),
      enumerable: true,
    });
  });
  return final;
}

/**
 * Unit of work to transform a primitive or javascript plain object to anything
 * @param {any} data
 * @param {Record<string, FunctionConstructor>} allowedClasses
 * @param {Record<number, any>} found
 * @returns {any}
 */
function plainToInstance(data, allowedClasses, found) {
  if (typeof data === "string" && data.indexOf(INSTANCE_PREFIX) === 0) {
    const index = parseInt(data.slice(INSTANCE_PREFIX.length));
    return found[index];
  }
  if (
    typeof data === "string" ||
    typeof data === "number" ||
    data === null ||
    data === undefined ||
    typeof data === "boolean"
  ) {
    return data;
  }

  if (data.constructor === Array) {
    if (data.length === 0) {
      return [];
    }
    const index = data.shift().slice(REFERENCE_PREFIX.length);
    /** @type {Array<PlainType|undefined>} */
    const transformed = [];
    found[index] = transformed;
    for (let elementIndex = 0; elementIndex < data.length; elementIndex++) {
      transformed[elementIndex] = plainToInstance(
        data[elementIndex],
        allowedClasses,
        found
      );
    }
    return transformed;
  }

  if (data.constructor === Object) {
    const index = data[REFERENCE_PREFIX];
    delete data[REFERENCE_PREFIX];

    if (!Object.keys(data).includes(CONSTRUCTOR_KEY)) {
      /** @type {Record<string,PlainType|undefined>} */
      const transformed = {};
      found[index] = transformed;
      for (const key in data) {
        transformed[key] = plainToInstance(data[key], allowedClasses, found);
      }
      return transformed;
    }
    const classname = data[CONSTRUCTOR_KEY];
    delete data[CONSTRUCTOR_KEY];

    const native = handlePlainToSpecial(data, classname, allowedClasses, found);
    if (native !== undefined) {
      return native;
    }
    if (!Object.keys(allowedClasses).includes(classname)) {
      throw new Error("The class " + classname + " is not allowed");
    }

    /** @type {Record<string,PlainType|undefined>} */
    let newObject = {};
    found[index] = newObject;
    for (const key in data) {
      newObject[key] = plainToInstance(data[key], allowedClasses, found);
    }
    Object.setPrototypeOf(newObject, allowedClasses[classname].prototype);

    return newObject;
  }
}

/**
 *
 * @param {object} object
 * @param {Array<any>} observed
 * @returns {undefined|object}
 */
function handleSpecialToPlain(object, observed) {
  if (!Object.keys(classHandlers).includes(object.constructor.name)) {
    return undefined;
  }

  return classHandlers[object.constructor.name].toPlain(object, (input) => {
    return instanceToPlain(input, observed);
  });
}

/**
 *
 * @param {object} object
 * @param {string} requested
 * @param {Record<string, FunctionConstructor>} allowedClasses
 * @param {Record<number, any>} found
 * @returns {*|undefined|undefined}
 */
function handlePlainToSpecial(object, requested, allowedClasses, found) {
  if (!Object.keys(classHandlers).includes(requested)) {
    return undefined;
  }

  return classHandlers[requested].fromPlain(object, (input) =>
    plainToInstance(input, allowedClasses, found)
  );
}

/**
 * Get the list of classes found during serialization
 * @returns {Array<FunctionConstructor>}
 */
export function getCollectedClasses() {
  return collectedClasses;
}

/**
 * Clear the list of classes found during serialization
 */
export function resetCollectedClasses() {
  collectedClasses = [];
}

/**
 * Defined the list of allowed classes for deserialization
 * @param {Record<string,FunctionConstructor>|Array<FunctionConstructor>} classes
 */
export function setGlobalAllowedClasses(classes) {
  if (classes.constructor === Array) {
    globalClasses = Object.fromEntries(
      classes.map((constructor) => [constructor.name, constructor])
    );
    return;
  }
  if (!Array.isArray(classes)) {
    globalClasses = classes;
  }
}

/**
 * Add a class in the list of allowed classes for deserialization
 * @param {FunctionConstructor} classConstructor
 */
export function addGlobalAllowedClass(classConstructor) {
  globalClasses[classConstructor.name] = classConstructor;
}

/**
 * Add a class handler
 * ---
 * **toPlain** is a function to transform an instance into a plain Javascript object.
 * - Its first parameter is the instant to transform, the second a function to transform any data to a plain Javascript object, a primitive or an array
 * - You can return `undefined` to let the default transformation occurs or an object
 *
 * **fromPlain** is a function to transform a plain Javascript object into a class instance (reverse function of `toPlain`)
 * - Its first parameter is the plain object, the second is a function to transform any data to a primitive, an array, an object or a class instance
 * - You can return `undefined` to let the default transformation occurs or final transformed object
 *
 * @param {string} classname The classname to handle
 * @param {(source: any, next: (data: any) => PlainType) => object | undefined} toPlain The function to transform the class instance (1rst param) to a JS plain object. The second parameter is the transformation process function. If undefined is return the normal transformation is used
 * @param {(source: object, next: (data: any) => any) => any | undefined} fromPlain The function to transform plain js object into a class instance. The second parameter is the transformation process function. If undefined is return the normal transformation is used
 */
export function addClassHandler(classname, toPlain, fromPlain) {
  classHandlers[classname] = { toPlain, fromPlain };
}

addNativeClasses(addClassHandler, addGlobalAllowedClass);
