export default function Card({ className = '', as: Tag = 'div', ...props }) {
  return (
    <Tag
      className={`rounded-[var(--radius-card)] clay p-4 ${className}`}
      {...props}
    />
  )
}
