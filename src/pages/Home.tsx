import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search, MapPin, Clock, Phone, ChevronRight } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import type { Pharmacy } from '../types';

const CITIES = ['Toutes', 'Dakar', 'Thiès', 'Saint-Louis', 'Ziguinchor', 'Kaolack', 'Diourbel'];

async function fetchPharmacies(): Promise<Pharmacy[]> {
  const { data, error } = await supabase
    .from('pharmacies')
    .select('*')
    .eq('is_active', true)
    .order('name');
  if (error) throw error;
  return data;
}

export default function Home() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [selectedCity, setSelectedCity] = useState('Toutes');

  const { data: pharmacies = [], isLoading } = useQuery({
    queryKey: ['pharmacies'],
    queryFn: fetchPharmacies,
  });

  const filtered = pharmacies.filter((p) => {
    const matchSearch =
      search === '' ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.address.toLowerCase().includes(search.toLowerCase()) ||
      p.city.toLowerCase().includes(search.toLowerCase());
    const matchCity = selectedCity === 'Toutes' || p.city === selectedCity;
    return matchSearch && matchCity;
  });

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Pharmacies</h1>
        <p className="text-gray-500 text-sm mt-1">Trouvez vos médicaments près de chez vous</p>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Rechercher une pharmacie..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* City filter */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-6 scrollbar-hide">
        {CITIES.map((city) => (
          <button
            key={city}
            onClick={() => setSelectedCity(city)}
            className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              selectedCity === city
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {city}
          </button>
        ))}
      </div>

      {/* Results */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-2xl p-5 animate-pulse">
              <div className="h-5 bg-gray-200 rounded w-1/2 mb-3" />
              <div className="h-4 bg-gray-100 rounded w-3/4 mb-2" />
              <div className="h-4 bg-gray-100 rounded w-1/4" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-4xl mb-3">🏥</div>
          <p className="text-gray-500">Aucune pharmacie trouvée</p>
          {search && (
            <button onClick={() => setSearch('')} className="text-primary-600 text-sm mt-2 hover:underline">
              Effacer la recherche
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-gray-500">{filtered.length} pharmacie{filtered.length > 1 ? 's' : ''} trouvée{filtered.length > 1 ? 's' : ''}</p>
          {filtered.map((pharmacy) => (
            <button
              key={pharmacy.id}
              onClick={() => navigate(`/pharmacy/${pharmacy.id}`)}
              className="w-full bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md hover:border-primary-200 transition-all text-left group"
            >
              <div className="flex gap-4">
                <div className="w-16 h-16 rounded-xl bg-primary-50 flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {pharmacy.image_url ? (
                    <img src={pharmacy.image_url} alt={pharmacy.name} className="w-full h-full object-cover rounded-xl" />
                  ) : (
                    <span className="text-2xl">🏥</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-gray-900 truncate">{pharmacy.name}</h3>
                    <Badge variant="success" className="flex-shrink-0">Ouverte</Badge>
                  </div>
                  <div className="flex items-center gap-1 text-sm text-gray-500 mt-1">
                    <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                    <span className="truncate">{pharmacy.address}, {pharmacy.city}</span>
                  </div>
                  {pharmacy.opening_hours && (
                    <div className="flex items-center gap-1 text-sm text-gray-500 mt-1">
                      <Clock className="h-3.5 w-3.5 flex-shrink-0" />
                      <span className="truncate">{pharmacy.opening_hours}</span>
                    </div>
                  )}
                  {pharmacy.phone && (
                    <div className="flex items-center gap-1 text-sm text-gray-500 mt-1">
                      <Phone className="h-3.5 w-3.5 flex-shrink-0" />
                      <span>{pharmacy.phone}</span>
                    </div>
                  )}
                </div>
                <ChevronRight className="h-5 w-5 text-gray-300 group-hover:text-primary-600 transition-colors flex-shrink-0 self-center" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
