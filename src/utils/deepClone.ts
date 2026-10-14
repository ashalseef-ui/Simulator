/**
 * Robust, high-performance deep clone utility with cycle detection.
 * Preserves Date, RegExp, Set, Map, and Arrays without losing prototypes
 * or failing on circular references.
 */
export function deepClone<T>(obj: T, seen = new WeakMap<object, any>()): T {
  // Primitives, functions, null, undefined
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  // Prevent infinite loops on circular references
  if (seen.has(obj as object)) {
    return seen.get(obj as object);
  }

  // Special object types
  if (obj instanceof Date) {
    return new Date(obj.getTime()) as any;
  }

  if (obj instanceof RegExp) {
    return new RegExp(obj.source, obj.flags) as any;
  }

  if (obj instanceof Set) {
    const cloneSet = new Set<any>();
    seen.set(obj, cloneSet);
    for (const val of obj) {
      cloneSet.add(deepClone(val, seen));
    }
    return cloneSet as any;
  }

  if (obj instanceof Map) {
    const cloneMap = new Map<any, any>();
    seen.set(obj, cloneMap);
    for (const [key, val] of obj) {
      cloneMap.set(deepClone(key, seen), deepClone(val, seen));
    }
    return cloneMap as any;
  }

  if (Array.isArray(obj)) {
    const cloneArr: any[] = [];
    seen.set(obj, cloneArr);
    for (let i = 0; i < obj.length; i++) {
      cloneArr[i] = deepClone(obj[i], seen);
    }
    return cloneArr as any;
  }

  // General Plain Object
  const clonedObj: any = Object.create(Object.getPrototypeOf(obj));
  seen.set(obj, clonedObj);

  for (const key of Object.keys(obj)) {
    clonedObj[key] = deepClone((obj as any)[key], seen);
  }

  return clonedObj;
}
