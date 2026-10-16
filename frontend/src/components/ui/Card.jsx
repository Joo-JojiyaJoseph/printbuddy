export default function Card({ className = '', as: Tag = 'div', ...props }) {
  return (
    <Tag
      className={`rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--card)] p-4 shadow-[0_6px_20px_rgba(10,74,82,.08)] ${className}`}
      {...props}
    />
  )
}
