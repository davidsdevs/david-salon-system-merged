import Button from "../../../components/ui/Button"
import { Clock, Banknote, ArrowLeft, Check, ChevronDown, ChevronUp } from "lucide-react"
import { useParams, Link } from "react-router-dom"
import { useState, useEffect } from "react"
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '../../../config/firebase'
import { getServiceById } from '../../../services/branchServicesService'
import BranchNavigation from "../../../components/landing/BranchNavigation"
import BranchFooter from "../../../components/landing/BranchFooter"

export default function ServiceDetailPage() {
  const { slug, serviceId } = useParams()
  const branchName = slug.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())
  
  const [isVisible, setIsVisible] = useState(false)
  const [openFAQ, setOpenFAQ] = useState(null)
  const [branchId, setBranchId] = useState(null)
  const [service, setService] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notAvailable, setNotAvailable] = useState(false)

  useEffect(() => {
    setIsVisible(true)
  }, [])

  // Resolve branchId by slug
  useEffect(() => {
    const findBranch = async () => {
      try {
        const branchesRef = collection(db, 'branches')
        const q = query(branchesRef, where('slug', '==', slug))
        const querySnapshot = await getDocs(q)

        if (!querySnapshot.empty) {
          setBranchId(querySnapshot.docs[0].id)
        } else {
          setBranchId(slug)
        }
      } catch (err) {
        console.error('Error finding branch by slug', err)
        setBranchId(slug)
      }
    }

    findBranch()
  }, [slug])

  // Load service details and check branch availability
  useEffect(() => {
    if (!branchId) return

    const loadService = async () => {
      setLoading(true)
      try {
        const s = await getServiceById(serviceId)
        // Check if service is configured for this branch (branchPricing)
        const hasForBranch = s.branchPricing && (s.branchPricing[branchId] !== undefined && s.branchPricing[branchId] !== null)
        if (!hasForBranch) {
          setNotAvailable(true)
          setService(null)
        } else {
          // include branch-specific price for display convenience
          const price = s.branchPricing[branchId]
          setService({ id: s.id, ...s, price })
          setNotAvailable(false)
        }
      } catch (err) {
        console.error('Error loading service:', err)
        setService(null)
        setNotAvailable(true)
      } finally {
        setLoading(false)
      }
    }

    loadService()
  }, [branchId, serviceId])

  // NOTE: the service data is now loaded from Firestore and validated for the current branch

  const whatsIncluded = [
    "Consultation with professional stylist",
    "Precision hair cutting",
    "Professional blow-dry and styling",
    "Hair care tips and maintenance advice",
    "Complimentary hair wash",
    "Styling product application"
  ]

  const recommendedStylists = [
    {
      name: "John Cruz",
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face"
    },
    {
      name: "Maria Santos",
      avatar: "https://images.unsplash.com/photo-1494790108755-2616b612b786?w=100&h=100&fit=crop&crop=face"
    }
  ]

  const serviceProcess = [
    {
      step: 1,
      title: "Consultation",
      description: "Discuss your desired look, lifestyle, and hair goals with your stylist"
    },
    {
      step: 2,
      title: "Hair Analysis",
      description: "Professional assessment of your hair type, texture, and face shape"
    },
    {
      step: 3,
      title: "Cutting",
      description: "Precision cutting using professional techniques and tools"
    },
    {
      step: 4,
      title: "Styling",
      description: "Professional blow-dry and styling to complete your new look"
    },
    {
      step: 5,
      title: "Finishing",
      description: "Final touches and styling tips for maintaining your new cut"
    }
  ]

  const beforeAfterImages = [
    {
      before: "https://images.unsplash.com/photo-1616683693504-3ea7e9ad6fec?w=300&h=300&fit=crop",
      after: "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=300&h=300&fit=crop",
      title: "Before",
      afterTitle: "After"
    },
    {
      before: "https://images.unsplash.com/photo-1616683693504-3ea7e9ad6fec?w=300&h=300&fit=crop",
      after: "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=300&h=300&fit=crop",
      title: "Before",
      afterTitle: "After"
    },
    {
      before: "https://images.unsplash.com/photo-1616683693504-3ea7e9ad6fec?w=300&h=300&fit=crop",
      after: "https://images.unsplash.com/photo-1633681926022-84c23e8cb2d6?w=300&h=300&fit=crop",
      title: "Before",
      afterTitle: "After"
    },
    {
      before: "https://images.unsplash.com/photo-1616683693504-3ea7e9ad6fec?w=300&h=300&fit=crop",
      after: "https://images.unsplash.com/photo-1559599101-f09722fb4948?w=300&h=300&fit=crop",
      title: "Before",
      afterTitle: "After"
    }
  ]

  const faqs = [
    {
      question: "How often should I get a haircut?",
      answer: "Generally every 6-8 weeks to maintain shape and health, but this varies based on your hair type and style."
    },
    {
      question: "Should I wash my hair before coming in?",
      answer: "Generally every 6-8 weeks to maintain shape and health, but this varies based on your hair type and style."
    },
    {
      question: "Can I bring reference photos?",
      answer: "Reference photos help us understand exactly what you're looking for."
    }
  ]

  const toggleFAQ = (index) => {
    setOpenFAQ(openFAQ === index ? null : index)
  }

  // Render different states: loading, not available, or show service details
  if (loading) {
    return (
      <>
        <BranchNavigation branchName={`${branchName} Branch`} />
        <div className="py-40 text-center text-gray-500">Loading service details…</div>
        <BranchFooter branchName={`${branchName} Branch`} branchPhone="+63 930 222 9659" branchAddress={`${branchName}, Philippines`} branchSlug={slug} />
      </>
    )
  }

  if (notAvailable) {
    return (
      <>
        <BranchNavigation branchName={`${branchName} Branch`} />
        <section className="py-40 px-6 text-center">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl font-poppins font-bold text-[#160B53] mb-4">Service not available</h2>
            <p className="text-gray-600 mb-6">The service you requested is not offered at the {branchName} branch.</p>
            <Link to={`/branch/${slug}/services`} className="inline-flex items-center gap-2 px-6 py-3 bg-[#160B53] text-white rounded-lg">Back to services</Link>
          </div>
        </section>
        <BranchFooter branchName={`${branchName} Branch`} branchPhone="+63 930 222 9659" branchAddress={`${branchName}, Philippines`} branchSlug={slug} />
      </>
    )
  }

  return (
    <>
      <BranchNavigation branchName={`${branchName} Branch`} />
      
      {/* Hero Section */}
      <section className="relative py-16 px-6 bg-gray-50" style={{ paddingTop: '138px' }}>
        <div className="max-w-6xl mx-auto">
          {/* Back Button */}
          <div className="mb-6">
            <Link 
              to={`/branch/${slug}/services`}
              className="inline-flex items-center gap-2 text-[#160B53] hover:text-[#160B53]/80 font-poppins font-medium transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Link>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Service Image */}
            <div className="relative">
              <img
                src={service.image}
                alt={service.name}
                className="w-full h-80 object-cover rounded-lg shadow-lg"
              />
              <div className="absolute top-4 left-4 flex gap-2">
                <span className="bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full text-sm font-poppins font-medium text-gray-700">
                  {service.category}
                </span>
                <span className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-sm font-poppins font-medium">
                  {service.tag}
                </span>
              </div>
            </div>

            {/* Service Info */}
            <div className={`transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
              <h1 className="text-4xl font-poppins font-bold text-[#160B53] mb-4">{service.name}</h1>
              <p className="text-lg text-gray-600 mb-6">{service.description}</p>
              
              {/* Service Details */}
              <div className="flex items-center gap-6 mb-8">
                <div className="flex items-center gap-2 text-gray-600">
                  <Clock className="w-5 h-5" />
                  <span className="font-poppins font-medium">{service.duration}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Banknote className="w-5 h-5 text-gray-600" />
                  <span className="font-poppins font-bold text-xl text-[#160B53]">{service.price}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-4">
                <Button size="lg" className="bg-[#160B53] hover:bg-[#160B53]/90 text-white font-poppins font-semibold">
                  Book This Service
                </Button>
                <Button size="lg" variant="outline" className="border-[#160B53] text-[#160B53] hover:bg-[#160B53] hover:text-white font-poppins font-semibold">
                  View Recommended Stylists
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* About This Service */}
      <section className="py-16 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-poppins font-bold text-[#160B53] mb-6">About This Service</h2>
          <p className="text-gray-600 leading-relaxed mb-8 text-lg">
            {service.longDescription}
          </p>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* What's Included */}
            <div>
              <h3 className="text-xl font-poppins font-bold text-gray-900 mb-4">What's Included</h3>
              <div className="space-y-3">
                {whatsIncluded.map((item, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                    <span className="text-gray-600">{item}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Recommended Stylists */}
            <div>
              <h3 className="text-xl font-poppins font-bold text-gray-900 mb-4">Recommended Stylists</h3>
              <div className="space-y-4">
                {recommendedStylists.map((stylist, index) => (
                  <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <img
                        src={stylist.avatar}
                        alt={stylist.name}
                        className="w-12 h-12 rounded-full object-cover"
                      />
                      <span className="font-poppins font-medium text-gray-900">{stylist.name}</span>
                    </div>
                    <Button size="sm" variant="outline" className="border-[#160B53] text-[#160B53] hover:bg-[#160B53] hover:text-white">
                      View Profile
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Service Process */}
      <section className="py-16 px-6 bg-[#160B53] text-white">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-poppins font-bold text-center mb-12">Service Process</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
            {serviceProcess.map((step, index) => (
              <div key={index} className="text-center">
                <div className="w-16 h-16 bg-white text-[#160B53] rounded-full flex items-center justify-center mx-auto mb-4 font-poppins font-bold text-xl">
                  {step.step}
                </div>
                <h3 className="font-poppins font-bold mb-2">{step.title}</h3>
                <p className="text-sm opacity-90">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Before & After Results */}
      <section className="py-16 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-poppins font-bold text-center text-[#160B53] mb-12">Before & After Results</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {beforeAfterImages.map((item, index) => (
              <div key={index} className="space-y-4">
                <div className="relative">
                  <img
                    src={item.before}
                    alt="Before"
                    className="w-full h-64 object-cover rounded-lg"
                  />
                  <div className="absolute bottom-2 left-2 bg-black/70 text-white px-2 py-1 rounded text-sm font-poppins font-medium">
                    Before
                  </div>
                </div>
                <div className="relative">
                  <img
                    src={item.after}
                    alt="After"
                    className="w-full h-64 object-cover rounded-lg"
                  />
                  <div className="absolute bottom-2 left-2 bg-black/70 text-white px-2 py-1 rounded text-sm font-poppins font-medium">
                    After
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-16 px-6 bg-gray-50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-poppins font-bold text-center text-[#160B53] mb-12">Frequently Asked Questions</h2>
          
          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <div key={index} className="bg-white rounded-lg shadow-sm border">
                <button
                  onClick={() => toggleFAQ(index)}
                  className="w-full p-6 text-left flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                  <span className="font-poppins font-medium text-gray-900">{faq.question}</span>
                  {openFAQ === index ? (
                    <ChevronUp className="w-5 h-5 text-gray-500" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-500" />
                  )}
                </button>
                {openFAQ === index && (
                  <div className="px-6 pb-6">
                    <p className="text-gray-600 leading-relaxed">{faq.answer}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>
      
      <BranchFooter 
        branchName={`${branchName} Branch`}
        branchPhone="+63 930 222 9659"
        branchAddress={`${branchName}, Philippines`}
        branchSlug={slug}
      />
    </>
  )
}

