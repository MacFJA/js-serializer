import { addNativeClasses } from "./native.js";
/**
 * List of constructor to use for data extraction
 */
let globalClasses: Record<string, FunctionConstructor> = {};
/**
 * List of constructor found during serialization
 */
let collectedClasses: Set<FunctionConstructor> = new Set<FunctionConstructor>();
/**
 * List of special class handler.
 * It allowed to define a custom serializer/deserializer for a class.
 *
 * Used, for example, to handle Javascript native classes
 */
const classHandlers: Record<
  string,
  {
    fromPlain: (source: object, next: (data: any) => any) => any | undefined;
    toPlain: (
      source: any,
      next: (data: any) => PlainType
    ) => object | undefined;
  }
> = {};

class UnexpectedJSONValueError extends Error {}

const CONSTRUCTOR_KEY = "#$@__constructor__";
const INSTANCE_PREFIX = "#$@__instance__";
const REFERENCE_PREFIX = "#$@__reference__";

type PlainType = string | number | boolean | object | any[];

/**
 * Serialized a data
 */
export function serialize(data: any): string {
  if (typeof data === "undefined") {
    return "undefined";
  }

  return JSON.stringify(instanceToPlain(data, []));
}

/**
 * Deserialize a string
 * @param text The serialized text
 * @param [allowedClasses] List of allowed classes for deserialization. It will be merged with the global allowed class list
 */
export function deserialize(
  text: string,
  allowedClasses: Record<string, FunctionConstructor> | undefined = undefined
): any {
  if (typeof text !== "string") {
    return text;
  }

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

  try {
    const parsed = JSON.parse(text);
    return plainToInstance(parsed, allowedClasses, {});
  } catch (e) {
    return text;
  }
}

/**
 * Unit of work to transform any data into a plain javascript object or a primitive.
 */
function instanceToPlain(data: any, observed: Array<any>): PlainType {
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
  const dataReference = observed.length - 1;

  if (data.constructor === Array) {
    let newArray = data.map((item) => instanceToPlain(item, observed));
    newArray.unshift(REFERENCE_PREFIX + dataReference);
    return newArray;
  }

  if (data.constructor === Object) {
    let newObject = Object.fromEntries(
      Object.entries(data).map(([key, value]) => [
        key,
        instanceToPlain(value, observed),
      ])
    );
    newObject[REFERENCE_PREFIX] = dataReference;
    return newObject;
  }

  collectedClasses.add(data.constructor);
  let final = {};
  final = Object.defineProperty(final, CONSTRUCTOR_KEY, {
    value: data.constructor.name,
    enumerable: true,
  });
  final = Object.defineProperty(final, REFERENCE_PREFIX, {
    value: dataReference,
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
 */
function plainToInstance(
  data: PlainType,
  allowedClasses: Record<string, FunctionConstructor>,
  found: Record<number, any>
): any {
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
    const indexLine = data.shift();
    if (
      typeof indexLine !== "string" ||
      indexLine.substring(0, REFERENCE_PREFIX.length) !== REFERENCE_PREFIX
    ) {
      if (Object.keys(found).length === 0) {
        data.unshift(indexLine);
        return data;
      }
      throw new UnexpectedJSONValueError();
    }
    const index = indexLine.slice(REFERENCE_PREFIX.length);
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
    const index = data[REFERENCE_PREFIX] ?? null;
    if (index === null) {
      if (Object.keys(found).length === 0) return data;
      throw new UnexpectedJSONValueError();
    }
    delete data[REFERENCE_PREFIX];

    if (!Object.keys(data).includes(CONSTRUCTOR_KEY)) {
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

    let newObject = {};
    found[index] = newObject;
    for (const key in data) {
      newObject[key] = plainToInstance(data[key], allowedClasses, found);
    }
    Object.setPrototypeOf(newObject, allowedClasses[classname].prototype);

    return newObject;
  }
}
function handleSpecialToPlain(
  object: object,
  observed: Array<any>
): object | undefined {
  if (!Object.keys(classHandlers).includes(object.constructor.name)) {
    return undefined;
  }

  return classHandlers[object.constructor.name].toPlain(object, (input) => {
    return instanceToPlain(input, observed);
  });
}
function handlePlainToSpecial(
  object: object,
  requested: string,
  allowedClasses: Record<string, FunctionConstructor>,
  found: Record<number, any>
): any | undefined {
  if (!Object.keys(classHandlers).includes(requested)) {
    return undefined;
  }

  return classHandlers[requested].fromPlain(object, (input) =>
    plainToInstance(input, allowedClasses, found)
  );
}

/**
 * Get the list of classes found during serialization
 * @param clear reset the list of classes found during serialization after reading it
 */
export function getCollectedClasses(
  clear: boolean = false
): Array<FunctionConstructor> {
  const collected = Array.from(collectedClasses);
  if (clear) {
    resetCollectedClasses();
  }
  return collected;
}

/**
 * Clear the list of classes found during serialization
 */
export function resetCollectedClasses(): void {
  collectedClasses.clear();
}

/**
 * Defined the list of allowed classes for deserialization.
 *
 * ---
 *
 * By default, this list contains:
 * - `Error`
 * - `EvalError`
 * - `RangeError`
 * - `AggregateError`
 * - `ReferenceError`
 * - `SyntaxError`
 * - `TypeError`
 * - `URIError`
 * - `Int8Array`
 * - `Uint8Array`
 * - `Uint8ClampedArray`
 * - `Int16Array`
 * - `Uint16Array`
 * - `Int32Array`
 * - `Uint32Array`
 * - `Float32Array`
 * - `Float64Array`
 * - `BigInt64Array`
 * - `BigUint64Array`
 *
 * @param classes List of classes that are allowed for deserialization
 * @param append If `true` the provided classes will be added to the existing list, if `false` (default) the provided list will replace.
 */
export function setGlobalAllowedClasses(
  classes: Record<string, FunctionConstructor> | Array<FunctionConstructor>,
  append: boolean = false
): void {
  let newClasses: Record<string, FunctionConstructor> = {};
  if (classes.constructor === Array) {
    newClasses = Object.fromEntries(
      classes.map((constructor) => [constructor.name, constructor])
    );
  }
  if (typeof classes === "object") {
    newClasses = classes as Record<string, FunctionConstructor>;
  }
  if (append) {
    globalClasses = Object.fromEntries([
      ...Object.entries(globalClasses),
      ...Object.entries(newClasses),
    ]);
    return;
  }

  globalClasses = newClasses;
}

/**
 * Add a class in the list of allowed classes for deserialization.
 */
export function addGlobalAllowedClass(classConstructor: FunctionConstructor) {
  globalClasses[classConstructor.name] = classConstructor;
}

/**
 * Add a class handler
 *
 * ---
 *
 * **toPlain** is a function to transform an instance into a plain Javascript object.
 * - Its first parameter is the instant to transform, the second a function to transform any data to a plain Javascript object, a primitive or an array
 * - You can return `undefined` to let the default transformation occurs or an object
 *
 * **fromPlain** is a function to transform a plain Javascript object into a class instance (reverse function of `toPlain`)
 * - Its first parameter is the plain object, the second is a function to transform any data to a primitive, an array, an object or a class instance
 * - You can return `undefined` to let the default transformation occurs or final transformed object
 *
 * @param classname The classname to handle
 * @param toPlain The function to transform the class instance (1rst param) to a JS plain object. The second parameter is the transformation process function. If undefined is return the normal transformation is used
 * @param fromPlain The function to transform plain js object into a class instance. The second parameter is the transformation process function. If undefined is return the normal transformation is used
 */
export function addClassHandler(
  classname: string,
  toPlain: (source: any, next: (data: any) => PlainType) => object | undefined,
  fromPlain: (source: object, next: (data: any) => any) => any | undefined
): void {
  classHandlers[classname] = { toPlain, fromPlain };
}

addNativeClasses(addClassHandler, addGlobalAllowedClass);
