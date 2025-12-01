import Header from '@/components/Header'
import Hero from '@/components/Hero'
import Services from '@/components/Services'
import Automation from '@/components/Automation'
import GlobalReach from '@/components/GlobalReach'
import ContactForm from '@/components/ContactForm'
import Footer from '@/components/Footer'
import PageBackground from '@/components/PageBackground'

export default function Home() {
  return (
    <div className="min-h-screen">
      <PageBackground />
      <Header />
      <Hero />
      <Services />
      <Automation />
      <GlobalReach />
      <ContactForm />
      <Footer />
    </div>
  )
}
