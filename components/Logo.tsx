import Image from 'next/image'

export default function Logo({ className = "w-10 h-10" }: { className?: string }) {
  return (
    <Image
      src="/logo.png"
      alt="JD Dental Lab Logo"
      width={200}
      height={200}
      className={className}
      priority
    />
  )
}
