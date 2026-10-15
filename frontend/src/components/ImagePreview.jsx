export default function ImagePreview({ url, name }) {
  return <img src={url} alt={`Preview of ${name}`} className="mx-auto max-h-[60vh] w-full rounded bg-white object-contain shadow-[0_10px_30px_rgba(10,5,60,.35)]" />
}
