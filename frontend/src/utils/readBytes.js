export const readBytes = (blob) =>
  blob.arrayBuffer
    ? blob.arrayBuffer()
    : new Promise((res, rej) => {
        const r = new FileReader()
        r.onload = () => res(r.result)
        r.onerror = rej
        r.readAsArrayBuffer(blob)
      })
