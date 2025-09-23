// Simple Google Maps embed component for displaying addresses
interface AddressMapProps {
  address: string;
  className?: string;
}

export default function AddressMap({ address, className = "" }: AddressMapProps) {
  // Create a properly encoded address for Google Maps embed
  const encodedAddress = encodeURIComponent(address);
  const mapSrc = `https://www.google.com/maps/embed/v1/place?key=AIzaSyBFw0Qbyq9zTFTd-tUY6dZWTgaQzuU17R8&q=${encodedAddress}`;
  
  // Alternative: Use Google Maps iframe without API key (public embed)
  const publicMapSrc = `https://maps.google.com/maps?q=${encodedAddress}&t=&z=15&ie=UTF8&iwloc=&output=embed`;

  return (
    <div className={`rounded-lg overflow-hidden border ${className}`}>
      <iframe
        src={publicMapSrc}
        width="100%"
        height="300"
        style={{ border: 0 }}
        allowFullScreen
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        title={`Map showing ${address}`}
        data-testid="component-address-map"
      />
    </div>
  );
}