import Button from "../../../components/ui/Button"
import { Card, CardContent } from "../../../components/ui/Card"
import { ArrowLeft, Clock, Banknote, ChevronLeft, ChevronRight, Palette, Shield, Sparkles } from "lucide-react"
import { useParams, Link } from "react-router-dom"
import { useState, useEffect } from "react"
import BranchNavigation from "../../../components/landing/BranchNavigation"
import BranchFooter from "../../../components/landing/BranchFooter"

export default function StylistProfilePage() {
  const { slug } = useParams()
  const branchName = slug.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())
  
  const [isVisible, setIsVisible] = useState(false)
  const [currentPortfolioPage, setCurrentPortfolioPage] = useState(1)

  useEffect(() => {
    setIsVisible(true)
  }, [])

  // Mock stylist data - in real app, this would come from API/database
  const stylist = {
    id: 1,
    name: "Maria Santos",
    specialty: "Color Specialist",
    experience: "8 years experience",
    rating: 4.9,
    reviews: 156,
    image: "https://images.unsplash.com/photo-1494790108755-2616b612b786?w=400&h=400&fit=crop&crop=face",
    description: "Maria is a passionate color specialist with over 8 years of experience in creating stunning hair transformations. She specializes in balayage, highlights, and color corrections. Maria has trained with top colorists in Europe and brings international techniques to David's Salon.",
    certifications: [
      { name: "L'Oreal Color Expert", icon: <Palette className="w-5 h-5 text-[#160B53]" /> },
      { name: "Wella Professional Certified", icon: <Shield className="w-5 h-5 text-[#160B53]" /> },
      { name: "Balayage Specialist", icon: <Sparkles className="w-5 h-5 text-[#160B53]" /> }
    ]
  }

  const specialtyServices = [
    {
      name: "Balayage",
      duration: "2-3 hours",
      price: "₱2,500-3,500",
      description: "Natural-looking highlights using freehand technique"
    },
    {
      name: "Full Color",
      duration: "2-3 hours",
      price: "₱1,800-2,800",
      description: "Complete hair color transformation"
    },
    {
      name: "Color Correction",
      duration: "3-4 hours",
      price: "₱3,500-5,000",
      description: "Fix and correct previous color treatments"
    },
    {
      name: "Highlights",
      duration: "2-3 hours",
      price: "₱1,500-2,500",
      description: "Traditional foil highlights for dimension"
    },
    {
      name: "Root Touch-up",
      duration: "1-2 hours",
      price: "₱800-1,200",
      description: "Maintain your color with root coverage"
    }
  ]

  const portfolioImages = [
    "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=300&h=300&fit=crop",
    "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=300&h=300&fit=crop",
    "https://images.unsplash.com/photo-1633681926022-84c23e8cb2d6?w=300&h=300&fit=crop",
    "https://images.unsplash.com/photo-1559599101-f09722fb4948?w=300&h=300&fit=crop",
    "https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?w=300&h=300&fit=crop",
    "https://images.unsplash.com/photo-1562322140-8baeececf3df?w=300&h=300&fit=crop"
  ]

  const portfolioPerPage = 6
  const totalPortfolioPages = Math.ceil(portfolioImages.length / portfolioPerPage)
  const startPortfolioIndex = (currentPortfolioPage - 1) * portfolioPerPage
  const currentPortfolioImages = portfolioImages.slice(startPortfolioIndex, startPortfolioIndex + portfolioPerPage)

  const clientReviews = [
    {
      name: "Maria Gonzalez",
      service: "Balayage",
      rating: 5,
      review: "Maria absolutely amazing! She transformed my hair with the most beautiful balayage! Very experienced and professional!",
      date: "2 weeks ago"
    },
    {
      name: "Jennifer Santos",
      service: "Color Correction",
      rating: 5,
      review: "Best color correction I've ever had! Maria fixed my previous salon disaster and made my hair look incredible!",
      date: "1 month ago"
    },
    {
      name: "Carlos Mendoza",
      service: "Full Color",
      rating: 5,
      review: "I've been going to Maria for 3 years now. She always knows exactly what I want and delivers perfectly every time!",
      date: "3 weeks ago"
    }
  ]

  const availableDays = [
    {
      day: "Monday",
      status: "Closed at Selected Branch",
      available: false
    },
    {
      day: "Tuesday",
      status: "Closed at Selected Branch",
      available: false
    },
    {
      day: "Wednesday",
      status: "Closed at Selected Branch",
      available: false
    },
    {
      day: "Thursday",
      status: "Closed at Selected Branch",
      available: false
    },
    {
      day: "Friday",
      status: "Closed at Selected Branch",
      available: false
    },
    {
      day: "Saturday",
      status: "Closed at Selected Branch",
      available: false
    }
  ]

  return (
    <>
      <BranchNavigation branchName={`${branchName} Branch`} />
      
      {/* Hero Section */}
      <section className="relative py-16 px-6 bg-[#160B53] text-white" style={{ paddingTop: '180px' }}>
        <div className="max-w-6xl mx-auto">

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Stylist Image */}
            <div className="relative">
              <img
                src={stylist.image}
                alt={stylist.name}
                className="w-full max-w-sm mx-auto h-80 object-cover rounded-lg shadow-lg"
              />
            </div>

            {/* Stylist Info */}
            <div className={`transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
              <h1 className="text-4xl font-poppins font-bold mb-2">{stylist.name}</h1>
              <p className="text-xl text-white/90 mb-4">{stylist.specialty}</p>
              
              <p className="text-lg leading-relaxed mb-6 text-white/80">
                {stylist.description}
              </p>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-4">
                <Link 
                  to={`/branch/${slug}/stylists`}
                  className="inline-flex items-center gap-2 px-4 py-2 border border-white text-white hover:text-white/80 font-poppins font-medium transition-colors rounded-lg bg-transparent"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Certifications & Training */}
      <section className="py-16 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-poppins font-bold text-center text-[#160B53] mb-12">Certifications & Training</h2>
          
          <div className="flex flex-wrap justify-center gap-8 md:gap-12">
            {stylist.certifications.map((cert, index) => (
              <div key={index} className="flex items-center gap-3 text-center">
                <div className="flex-shrink-0">{cert.icon}</div>
                <h3 className="font-poppins font-medium text-gray-900">{cert.name}</h3>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Specialty Services */}
      <section className="py-16 px-6 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-poppins font-bold text-center text-[#160B53] mb-12">Specialty Services</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {specialtyServices.map((service, index) => (
              <Card key={index} className="p-6 hover:shadow-lg transition-shadow" style={{ 
                borderColor: '#DBDBDB',
                boxShadow: '0 2px 15px 0 rgba(0, 0, 0, 0.25)'
              }}>
                <CardContent className="p-0">
                  <h3 className="text-xl font-poppins font-bold text-gray-900 mb-2">{service.name}</h3>
                  <p className="text-gray-600 text-sm mb-4">{service.description}</p>
                  
                  <div className="flex items-center justify-between mb-4 text-sm text-gray-500">
                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      <span>{service.duration}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Banknote className="w-4 h-4" />
                      <span className="font-poppins font-semibold text-[#160B53]">{service.price}</span>
                    </div>
                  </div>
                  
                  <Button 
                    size="sm" 
                    className="w-full bg-[#160B53] hover:bg-[#160B53]/90 text-white font-poppins font-medium"
                  >
                    Book {service.name}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Portfolio */}
      <section className="py-16 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-poppins font-bold text-center text-[#160B53] mb-12">Portfolio</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {currentPortfolioImages.map((image, index) => (
              <div key={index} className="aspect-square bg-gray-200 rounded-lg overflow-hidden hover:scale-105 transition-transform duration-300 cursor-pointer" style={{ 
                borderColor: '#DBDBDB', 
                borderWidth: '1px', 
                borderStyle: 'solid',
                boxShadow: '0 2px 15px 0 rgba(0, 0, 0, 0.25)'
              }}>
                <img
                  src={image}
                  alt={`Portfolio ${startPortfolioIndex + index + 1}`}
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
          </div>

          {/* Portfolio Pagination */}
          {totalPortfolioPages > 1 && (
            <div className="flex justify-center items-center gap-2">
              <button
                onClick={() => setCurrentPortfolioPage(Math.max(1, currentPortfolioPage - 1))}
                disabled={currentPortfolioPage === 1}
                className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              
              {[...Array(totalPortfolioPages)].map((_, index) => {
                const page = index + 1
                return (
                  <button
                    key={page}
                    onClick={() => setCurrentPortfolioPage(page)}
                    className={`w-10 h-10 rounded-lg font-poppins font-medium transition-all duration-300 ${
                      currentPortfolioPage === page
                        ? 'bg-[#160B53] text-white scale-105'
                        : 'bg-transparent text-gray-700 border border-gray-300 hover:bg-gray-50 hover:scale-105'
                    }`}
                  >
                    {page}
                  </button>
                )
              })}
              
              <button
                onClick={() => setCurrentPortfolioPage(Math.min(totalPortfolioPages, currentPortfolioPage + 1))}
                disabled={currentPortfolioPage === totalPortfolioPages}
                className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Client Reviews */}
      <section className="py-16 px-6 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-poppins font-bold text-center text-[#160B53] mb-12">Client Reviews</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {clientReviews.map((review, index) => (
              <Card key={index} className="p-6" style={{ 
                borderColor: '#DBDBDB',
                boxShadow: '0 2px 15px 0 rgba(0, 0, 0, 0.25)'
              }}>
                <CardContent className="p-0">
                  <div className="text-6xl text-[#160B53] mb-4">"</div>
                  <p className="text-gray-700 mb-6 leading-relaxed">{review.review}</p>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-poppins font-semibold text-[#160B53]">{review.name}</div>
                      <div className="text-sm text-gray-500">{review.service}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Stylist's Schedule */}
      <section className="py-16 px-6 bg-[#160B53] text-white">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-poppins font-bold text-center mb-12">Stylist's Schedule</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {availableDays.map((day, index) => (
              <Card key={index} className="bg-white text-gray-900 p-6">
                <CardContent className="p-0">
                  <h3 className="text-xl font-poppins font-bold mb-2">{day.day}</h3>
                  <p className="text-sm text-gray-600 mb-4">{day.status}</p>
                  <Button 
                    size="sm" 
                    disabled={!day.available}
                    className={`w-full font-poppins font-medium ${
                      day.available 
                        ? 'bg-[#160B53] hover:bg-[#160B53]/90 text-white'
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    {day.available ? 'Book Now' : 'Book Now'}
                  </Button>
                </CardContent>
              </Card>
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

