export default function Card({ className = '', as: Tag = 'div', ...props }) {
  return (
    <Tag
      className={`rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--card)] p-4 backdrop-blur-md shadow-[0_8px_24px_rgba(10,5,60,.15)] ${className}`}
      {...props}
    />
  )
}
