/**
 * Settings Page
 * Main settings page with cards for Branch Services, Products, Page Contents, and Settings
 */

import { useNavigate } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Scissors, Package, FileText, Building2, ArrowRight, Banknote, Image, Clock, Users } from 'lucide-react';

const Settings = () => {
  const navigate = useNavigate();

  const settingsCards = [
    {
      id: 'services',
      title: 'Branch Services',
      shortDescription: 'Manage services and pricing',
      description: 'Configure which services are offered at your branch, set custom prices for each service, enable or disable service availability, and manage service categories. Control your service catalog to match your branch\'s offerings and pricing strategy.',
      icon: Scissors,
      path: '/manager/settings/services',
      gradient: 'from-blue-500 to-blue-600',
      iconBg: 'bg-blue-100',
      iconColor: 'text-blue-600',
      features: ['Service pricing', 'Availability control', 'Category management']
    },
    {
      id: 'products',
      title: 'Branch Products',
      shortDescription: 'View available products',
      description: 'Browse and view all products available at your branch. See product details including pricing, inventory information, supplier details, and product specifications. Monitor which products are assigned to your branch for sale and salon use.',
      icon: Package,
      path: '/manager/settings/products',
      gradient: 'from-green-500 to-green-600',
      iconBg: 'bg-green-100',
      iconColor: 'text-green-600',
      features: ['Product catalog', 'Pricing details', 'Inventory info']
    },
    {
      id: 'page-contents',
      title: 'Branch Page Contents',
      shortDescription: 'Manage public page content',
      description: 'Customize your branch\'s public-facing page content including hero sections, about descriptions, service highlights, and promotional content. Update your branch page to showcase your services and attract customers through the public website.',
      icon: FileText,
      path: '/manager/settings/page-contents',
      gradient: 'from-purple-500 to-purple-600',
      iconBg: 'bg-purple-100',
      iconColor: 'text-purple-600',
      features: ['Hero sections', 'About content', 'Public information']
    },
    {
      id: 'branch-settings',
      title: 'Branch Settings',
      shortDescription: 'Configure branch details',
      description: 'Manage your branch\'s core information including contact details, physical address, email, phone number, and operating hours. Set up your branch schedule, configure special hours for holidays, and maintain accurate branch information for customers and staff.',
      icon: Building2,
      path: '/manager/settings/branch-settings',
      gradient: 'from-orange-500 to-orange-600',
      iconBg: 'bg-orange-100',
      iconColor: 'text-orange-600',
      features: ['Contact information', 'Operating hours', 'Branch details']
    }
  ];

  const handleCardClick = (path) => {
    navigate(path);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-3">Settings</h1>
        <p className="text-lg text-gray-600">Manage your branch configuration, services, products, and public-facing content</p>
      </div>

      {/* Settings Cards Grid - 2x2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {settingsCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card
              key={card.id}
              className="p-8 cursor-pointer hover:shadow-2xl transition-all duration-300 group border-2 border-transparent hover:border-gray-200 overflow-hidden relative"
              onClick={() => handleCardClick(card.path)}
            >
              {/* Gradient Background Accent */}
              <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${card.gradient} opacity-5 group-hover:opacity-10 transition-opacity duration-300 rounded-bl-full`}></div>
              
              <div className="relative z-10">
                {/* Icon and Title Section */}
                <div className="flex items-start gap-6 mb-6">
                  <div className={`${card.iconBg} p-4 rounded-2xl group-hover:scale-110 transition-transform duration-300 shadow-lg`}>
                    <Icon className={`h-8 w-8 ${card.iconColor}`} />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-2xl font-bold text-gray-900 mb-2 group-hover:text-[#160B53] transition-colors">
                      {card.title}
                    </h3>
                    <p className="text-sm font-medium text-gray-500 mb-1">
                      {card.shortDescription}
                    </p>
                  </div>
                </div>

                {/* Description */}
                <p className="text-gray-600 text-base leading-relaxed mb-6 min-h-[4.5rem]">
                  {card.description}
                </p>

                {/* Features List */}
                <div className="flex flex-wrap gap-2 mb-6">
                  {card.features.map((feature, index) => (
                    <span
                      key={index}
                      className="px-3 py-1.5 bg-gray-100 text-gray-700 text-xs font-medium rounded-full"
                    >
                      {feature}
                    </span>
                  ))}
                </div>

                {/* Action Button */}
                <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                  <span className="text-sm font-medium text-gray-500">Click to manage</span>
                  <div className="flex items-center text-[#160B53] font-semibold group-hover:gap-2 transition-all">
                    <span>Open</span>
                    <ArrowRight className="h-5 w-5 ml-1 group-hover:translate-x-2 transition-transform" />
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Info Section */}
      <Card className="p-6 bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
        <div className="flex items-start gap-4">
          <div className="p-2 bg-blue-100 rounded-lg">
            <FileText className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h4 className="font-semibold text-gray-900 mb-1">About Settings</h4>
            <p className="text-sm text-gray-600">
              Each settings section allows you to configure different aspects of your branch. 
              Changes made here will affect how your branch appears to customers and how your staff can manage operations.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default Settings;

