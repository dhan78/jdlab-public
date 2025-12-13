import Logo from './Logo'

export default function Footer() {
  return (
    <footer className="bg-dark text-white mt-20">
      <div className="container-wide section-padding">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <Logo className="w-10 h-10" />
              <h3 className="font-bold text-lg">JD Dental Lab</h3>
            </div>
            <p className="text-gray-400">Leading digital dental and medical devices lab serving the world.</p>
          </div>
          <div>
            <h4 className="font-semibold mb-4">Services</h4>
            <ul className="space-y-2 text-gray-400">
              <li><a href="#" className="hover:text-secondary transition">CAD/CAM Design</a></li>
              <li><a href="#" className="hover:text-secondary transition">3D Printing</a></li>
              <li><a href="#" className="hover:text-secondary transition">Crowns & Bridges</a></li>
              <li><a href="#" className="hover:text-secondary transition">Implants</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-4">Company</h4>
            <ul className="space-y-2 text-gray-400">
              <li><a href="#" className="hover:text-secondary transition">About</a></li>
              <li><a href="#" className="hover:text-secondary transition">Blog</a></li>
              <li><a href="#" className="hover:text-secondary transition">Careers</a></li>
              <li><a href="#" className="hover:text-secondary transition">Contact</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-4">Legal</h4>
            <ul className="space-y-2 text-gray-400">
              <li><a href="#" className="hover:text-secondary transition">Privacy Policy</a></li>
              <li><a href="#" className="hover:text-secondary transition">Terms of Service</a></li>
              <li><a href="#" className="hover:text-secondary transition">Compliance</a></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-gray-700 pt-8 text-center text-gray-400">
          <p>&copy; 2025 JD Dental Lab. All rights reserved.</p>
        </div>
      </div>
    </footer>
  )
}
