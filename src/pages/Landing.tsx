import { Link } from 'react-router-dom';
import { MapPin, Clock, ShieldCheck, Truck, ChevronRight, Phone } from 'lucide-react';
import { Button } from '../components/ui/button';

export default function Landing() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-white/90 backdrop-blur border-b border-gray-100 flex items-center justify-between px-6 h-16">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">P</span>
          </div>
          <span className="text-xl font-bold text-primary-600">PHARMASEN</span>
        </div>
        <Link to="/auth">
          <Button size="sm">Connexion</Button>
        </Link>
      </header>

      {/* Hero */}
      <section className="pt-16 min-h-screen flex items-center bg-gradient-to-br from-primary-50 via-white to-green-50">
        <div className="max-w-6xl mx-auto px-6 py-20 grid md:grid-cols-2 gap-12 items-center">
          <div>
            <span className="inline-block bg-primary-100 text-primary-700 text-sm font-semibold px-3 py-1 rounded-full mb-4">
              Plateforme de santé au Sénégal
            </span>
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 leading-tight mb-6">
              Vos médicaments,{' '}
              <span className="text-primary-600">livrés rapidement</span>
            </h1>
            <p className="text-lg text-gray-600 mb-8 leading-relaxed">
              PHARMASEN connecte les clients aux pharmacies du Sénégal. Trouvez vos médicaments,
              passez votre commande et faites-vous livrer ou venez les récupérer.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link to="/auth">
                <Button size="lg" className="w-full sm:w-auto gap-2">
                  Commencer maintenant <ChevronRight className="h-5 w-5" />
                </Button>
              </Link>
              <Link to="/auth">
                <Button size="lg" variant="outline" className="w-full sm:w-auto">
                  Espace pharmacien
                </Button>
              </Link>
            </div>
          </div>
          <div className="hidden md:flex justify-center">
            <div className="relative w-80 h-80">
              <div className="absolute inset-0 bg-primary-600 rounded-3xl opacity-10 rotate-6" />
              <div className="absolute inset-0 bg-primary-600 rounded-3xl opacity-10 -rotate-3" />
              <div className="relative bg-white rounded-3xl shadow-2xl p-8 flex flex-col items-center justify-center gap-6">
                <div className="w-20 h-20 bg-primary-100 rounded-2xl flex items-center justify-center">
                  <span className="text-4xl">💊</span>
                </div>
                <div className="text-center">
                  <p className="font-bold text-gray-900 text-lg">500+ médicaments</p>
                  <p className="text-gray-500 text-sm">disponibles dans nos pharmacies</p>
                </div>
                <div className="w-full bg-gray-100 rounded-xl p-3 flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary-600 rounded-lg flex items-center justify-center">
                    <MapPin className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-gray-900">Pharmacie Centrale Dakar</p>
                    <p className="text-xs text-gray-500">Ouverte · 2.3 km</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Pourquoi choisir PHARMASEN ?</h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Une plateforme simple et sécurisée pour accéder à vos médicaments où que vous soyez au Sénégal.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: MapPin, title: 'Pharmacies proches', desc: 'Trouvez rapidement une pharmacie près de vous dans votre ville.' },
              { icon: Clock, title: 'Commande rapide', desc: 'Passez votre commande en quelques clics et suivez son statut en temps réel.' },
              { icon: ShieldCheck, title: 'Ordonnances validées', desc: 'Envoyez votre ordonnance en photo pour les médicaments qui le nécessitent.' },
              { icon: Truck, title: 'Livraison ou retrait', desc: 'Choisissez entre la livraison à domicile ou le retrait en pharmacie.' },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="bg-gray-50 rounded-2xl p-6 hover:shadow-md transition-shadow">
                <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center mb-4">
                  <Icon className="h-6 w-6 text-primary-600" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">{title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-primary-600">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Prêt à commencer ?</h2>
          <p className="text-primary-100 text-lg mb-8">
            Rejoignez des milliers de Sénégalais qui font confiance à PHARMASEN pour leur santé.
          </p>
          <Link to="/auth">
            <Button size="lg" variant="outline" className="bg-white text-primary-600 hover:bg-primary-50 border-white gap-2">
              Créer mon compte gratuitement <ChevronRight className="h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-12 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">P</span>
            </div>
            <span className="text-xl font-bold text-white">PHARMASEN</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Phone className="h-4 w-4" />
            <span>+221 33 000 00 00</span>
          </div>
          <p className="text-sm">© 2025 PHARMASEN. Tous droits réservés.</p>
        </div>
      </footer>
    </div>
  );
}
