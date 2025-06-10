export function debounce(fn: any, delay: number) {
  let timeoutID: number;
  return function (...args: any) {
    clearTimeout(timeoutID);
    timeoutID = setTimeout(() => fn(...args), timeoutID ? delay : 0) as any;
  };
}
