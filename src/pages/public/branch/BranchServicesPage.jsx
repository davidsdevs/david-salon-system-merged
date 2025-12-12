import Button from "../../../components/ui/Button"
import { Card } from "../../../components/ui/Card"
import { CTAButton, SecondaryButton } from "../../../components/ui/ConsistentButton"
import { Clock, Banknote, Filter } from "lucide-react"
import { useParams, Link } from "react-router-dom"
import { useState, useEffect } from "react"
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '../../../config/firebase'
import { getBranchServices } from '../../../services/branchServicesService'
import BranchNavigation from "../../../components/landing/BranchNavigation"
import BranchFooter from "../../../components/landing/BranchFooter"

export default function BranchServicesPage() {
  const { slug } = useParams()
  const branchName = slug.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())
  
  const [selectedCategory, setSelectedCategory] = useState("All")
  const [isVisible, setIsVisible] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const servicesPerPage = 6

  useEffect(() => {
    setIsVisible(true)
  }, [])

  // state for dynamic services (loaded from Firestore / branchServicesService)
  const [branchId, setBranchId] = useState(null)
  const [services, setServices] = useState([])
  const [loadingServices, setLoadingServices] = useState(true)

  // Find branchId by slug (branches collection is assumed to have a slug field)
  useEffect(() => {
    const findBranch = async () => {
      try {
        const branchesRef = collection(db, 'branches')
        const q = query(branchesRef, where('slug', '==', slug))
        const querySnapshot = await getDocs(q)

        if (!querySnapshot.empty) {
          setBranchId(querySnapshot.docs[0].id)
        } else {
          // fallback - if branch doc doesn't exist, use slug as id
          setBranchId(slug)
        }
      } catch (err) {
        console.error('Error finding branch by slug:', err)
        setBranchId(slug)
      }
    }

    findBranch()
  }, [slug])

  // Load services for the selected branch
  useEffect(() => {
    if (!branchId) return

    const loadServices = async () => {
      setLoadingServices(true)
      try {
        const results = await getBranchServices(branchId)
        setServices(results)
      } catch (err) {
        console.error('Failed to load branch services:', err)
        setServices([])
      } finally {
        setLoadingServices(false)
      }
    }

    loadServices()
  }, [branchId])

  // derive categories from services but keep sensible defaults
  const categories = [
    'All',
    ...Array.from(new Set(services.map(s => s.category).filter(Boolean)))
  ]

  const filteredServices = services.filter(service => {
    // If still loading or service entry doesn't have expected fields use safe values
    const category = service.category || service.serviceType || 'Uncategorized'
    return selectedCategory === 'All' || category === selectedCategory
  })

  // Pagination logic
  const totalPages = Math.ceil(filteredServices.length / servicesPerPage)
  const startIndex = (currentPage - 1) * servicesPerPage
  const endIndex = startIndex + servicesPerPage
  const currentServices = filteredServices.slice(startIndex, endIndex)

  // Reset to first page when category changes
  useEffect(() => {
    setCurrentPage(1)
  }, [selectedCategory])

  return (
    <>
      {/* Branch Navigation */}
      <BranchNavigation branchName={`${branchName} Branch`} />
      
      {/* Header Section */}
      <section className="py-12 px-6 bg-gray-50 mt-[122px]">
        <div className={`max-w-6xl mx-auto text-center transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <h1 className="text-5xl font-poppins font-bold text-[#160B53] mb-4">Services</h1>
          <p className="text-xl text-gray-600 mb-6">Professional hair and beauty services tailored to your needs</p>
          
          {/* Category Filter */}
          <div className="flex flex-wrap justify-center gap-3">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full font-poppins font-medium transition-all duration-300 ${
                  selectedCategory === category
                    ? 'bg-[#160B53] text-white scale-105'
                    : 'bg-white text-gray-600 hover:bg-gray-100 hover:scale-105 border border-gray-200'
                }`}
              >
                {category === "All" && <Filter className="w-4 h-4" />}
                {category}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Services Grid */}
      <section className="py-8 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {loadingServices ? (
              <div className="col-span-full text-center py-16">
                <div className="text-2xl text-gray-500">Loading services…</div>
              </div>
            ) : (
              currentServices.map((service, index) => (
              <Card 
                key={service.id}
                className="overflow-hidden border-0 p-0"
                style={{ boxShadow: '0 2px 15px 0 rgba(0, 0, 0, 0.25)' }}
              >
                {/* Service Image */}
                <div className="relative h-48 bg-gray-100 overflow-hidden">
                  <img
                    src={service.image || service.media?.[0]?.url || '/images/placeholder/service-default.jpg'}
                    alt={service.name || service.serviceName}
                    className="w-full h-full object-cover"
                  />
                  {/* Service Tag */}
                    {(service.tag || service.tagLabel) && (
                    <div className={`absolute top-3 right-3 px-3 py-1 rounded-full text-sm font-poppins font-medium ${service.tagColor}`}>
                      {service.tag || service.tagLabel}
                    </div>
                  )}
                  {/* Category Badge */}
                  <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-full text-xs font-poppins font-medium text-gray-700">
                    {service.category}
                  </div>
                </div>

                <div className="p-6">
                  <h3 className="text-xl font-poppins font-bold mb-2 text-gray-900">
                    {service.name || service.serviceName}
                  </h3>
                  
                    <p className="text-gray-600 text-sm mb-4 line-clamp-2">{service.description || service.shortDescription || ''}</p>
                  
                  {/* Service Details */}
                  <div className="flex items-center gap-4 mb-4 text-sm text-gray-500">
                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      <span>{service.duration}</span>
                    </div>
                    <div className="flex items-center gap-1">
<<<<<<< HEAD
                      <DollarSign className="w-4 h-4" />
                      <span className="font-poppins font-semibold text-[#160B53]">{service.price == null ? (service.branchPricing || '—') : service.price}</span>
=======
                      <Banknote className="w-4 h-4" />
                      <span className="font-poppins font-semibold text-[#160B53]">{service.price}</span>
>>>>>>> 7713a9f67f1c6565bd01262aaa6791d868a6e940
                    </div>
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="flex flex-col gap-2">
                    <Link to={`/branch/${slug}/services/${service.id}`}>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full border-gray-300 text-gray-700 hover:bg-gray-50"
                      >
                        View Service Details
                      </Button>
                    </Link>
                    <Button
                      size="sm"
                      className="w-full bg-[#160B53] hover:bg-[#160B53]/90 text-white"
                    >
                      Book This Service
                    </Button>
                  </div>
                </div>
              </Card>
              ))
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center mt-12 space-x-2">
              <Button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                variant="outline"
                className="px-4 py-2"
              >
                Previous
              </Button>
              
              <div className="flex space-x-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <Button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    variant={currentPage === page ? "default" : "outline"}
                    className={`px-3 py-2 ${
                      currentPage === page 
                        ? 'bg-[#160B53] text-white hover:bg-[#160B53]/90' 
                        : 'hover:bg-gray-100'
                    }`}
                  >
                    {page}
                  </Button>
                ))}
              </div>
              
              <Button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                variant="outline"
                className="px-4 py-2"
              >
                Next
              </Button>
            </div>
          )}

          {/* Empty State */}
          {filteredServices.length === 0 && (
            <div className="text-center py-16">
              <div className="text-6xl mb-4">💇‍♀️</div>
              <h3 className="text-xl font-poppins font-semibold text-gray-600 mb-2">No services found</h3>
              <p className="text-gray-500">Try selecting a different category</p>
            </div>
          )}
        </div>
      </section>

      {/* Call to Action Section */}
      <section className="py-16 px-6 bg-[#160B53] text-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="font-poppins font-bold mb-4" style={{ fontSize: '50px' }}>Ready to Transform Your Look?</h2>
          <p className="text-xl mb-8 opacity-90">Book your appointment today and experience our professional services</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <CTAButton className="bg-white text-[#160B53] hover:bg-gray-100">
              Book Appointment
            </CTAButton>
            <SecondaryButton className="border-white text-white hover:bg-white hover:text-[#160B53]">
              Call Us Now
            </SecondaryButton>
          </div>
        </div>
      </section>
      
      {/* Footer */}
      <BranchFooter 
        branchName={`${branchName} Branch`}
        branchPhone="+63 930 222 9659"
        branchAddress={`${branchName}, Philippines`}
        branchSlug={slug}
      />
    </>
  )
}

