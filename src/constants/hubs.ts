import type { City } from '@/store/bookings';

/**
 * The LOCI partner hub network.
 *
 * Lives here rather than inside the locations screen because the booking form
 * also needs it: choosing "LOCI hub" as the pickup mode offers these, filtered
 * to the selected city.
 */
export type Hub = {
  id: string;
  name: string;
  area: string;
  city: City;
  address: string;
  hours: string;
  phone: string;
  services: string[];
  /** Flagship hub for that city — surfaced with a badge. */
  flagship?: boolean;
};

/** Placeholder network — replace with a hubs endpoint when one exists. */
export const HUBS: Hub[] = [
  // ---- Lagos ----
  {
    id: 'lag-1',
    name: 'LOCI Ikeja Hub',
    area: 'Ikeja',
    city: 'Lagos',
    address: '45 Allen Avenue, Ikeja, Lagos',
    hours: 'Mon–Sat, 8:00am – 8:00pm',
    phone: '+2348030001101',
    services: ['Drop-off', 'Collection', 'Packaging'],
    flagship: true,
  },
  {
    id: 'lag-2',
    name: 'LOCI Yaba Counter',
    area: 'Yaba',
    city: 'Lagos',
    address: '12 Herbert Macaulay Way, Yaba, Lagos',
    hours: 'Mon–Fri, 9:00am – 6:00pm',
    phone: '+2348030001102',
    services: ['Drop-off', 'Collection'],
  },
  {
    id: 'lag-3',
    name: 'LOCI Lekki Point',
    area: 'Lekki',
    city: 'Lagos',
    address: '3 Admiralty Way, Lekki Phase 1, Lagos',
    hours: 'Mon–Sat, 9:00am – 7:00pm',
    phone: '+2348030001103',
    services: ['Drop-off', 'Collection'],
  },
  // ---- Ibadan ----
  {
    id: 'ib-1',
    name: 'LOCI Bodija Hub',
    area: 'Bodija',
    city: 'Ibadan',
    address: '18 Awolowo Avenue, Old Bodija, Ibadan',
    hours: 'Mon–Sat, 8:00am – 7:00pm',
    phone: '+2348030002201',
    services: ['Drop-off', 'Collection', 'Packaging'],
    flagship: true,
  },
  {
    id: 'ib-2',
    name: 'LOCI Dugbe Counter',
    area: 'Dugbe',
    city: 'Ibadan',
    address: '8 Lebanon Street, Dugbe, Ibadan',
    hours: 'Mon–Fri, 9:00am – 6:00pm',
    phone: '+2348030002202',
    services: ['Drop-off', 'Collection'],
  },
  {
    id: 'ib-3',
    name: 'LOCI Ring Road Point',
    area: 'Ring Road',
    city: 'Ibadan',
    address: '22 Ring Road, Challenge, Ibadan',
    hours: 'Mon–Sat, 8:00am – 8:00pm',
    phone: '+2348030002203',
    services: ['Drop-off'],
  },
  {
    id: 'ib-4',
    name: 'LOCI Mokola Counter',
    area: 'Mokola',
    city: 'Ibadan',
    address: '5 Mokola Roundabout, Ibadan',
    hours: 'Mon–Sat, 8:00am – 7:00pm',
    phone: '+2348030002204',
    services: ['Drop-off', 'Collection'],
  },
  {
    id: 'ib-5',
    name: 'LOCI Challenge Point',
    area: 'Challenge',
    city: 'Ibadan',
    address: '31 Challenge Road, Ibadan',
    hours: 'Mon–Sat, 8:00am – 6:00pm',
    phone: '+2348030002205',
    services: ['Drop-off'],
  },
  {
    id: 'ib-6',
    name: 'LOCI UI/Agbowo Counter',
    area: 'UI/Agbowo',
    city: 'Ibadan',
    address: '2 Agbowo Express, Beside UI Gate, Ibadan',
    hours: 'Mon–Sat, 9:00am – 7:00pm',
    phone: '+2348030002206',
    services: ['Drop-off', 'Collection'],
  },
  {
    id: 'ib-7',
    name: 'LOCI Iwo Road Hub',
    area: 'Iwo Road',
    city: 'Ibadan',
    address: '9 Iwo Road Interchange, Ibadan',
    hours: 'Mon–Sat, 7:30am – 8:00pm',
    phone: '+2348030002207',
    services: ['Drop-off', 'Collection'],
  },
  {
    id: 'ib-8',
    name: 'LOCI Apata Counter',
    area: 'Apata',
    city: 'Ibadan',
    address: '16 Apata Ganga Road, Ibadan',
    hours: 'Mon–Fri, 9:00am – 6:00pm',
    phone: '+2348030002208',
    services: ['Drop-off', 'Collection'],
  },
  {
    id: 'ib-9',
    name: 'LOCI Sango Point',
    area: 'Sango',
    city: 'Ibadan',
    address: '4 Sango–Eleyele Road, Ibadan',
    hours: 'Mon–Sat, 8:00am – 6:00pm',
    phone: '+2348030002209',
    services: ['Drop-off'],
  },
  {
    id: 'ib-10',
    name: 'LOCI Akobo Counter',
    area: 'Akobo',
    city: 'Ibadan',
    address: '27 Akobo Ojurin Road, Ibadan',
    hours: 'Mon–Fri, 9:00am – 6:00pm',
    phone: '+2348030002210',
    services: ['Drop-off', 'Collection'],
  },
  // ---- Abuja ----
  {
    id: 'abj-1',
    name: 'LOCI Wuse II Hub',
    area: 'Wuse II',
    city: 'Abuja',
    address: '14 Aminu Kano Crescent, Wuse II, Abuja',
    hours: 'Mon–Sat, 8:00am – 7:00pm',
    phone: '+2348030003301',
    services: ['Drop-off', 'Collection', 'Packaging'],
    flagship: true,
  },
  {
    id: 'abj-2',
    name: 'LOCI Garki Counter',
    area: 'Garki',
    city: 'Abuja',
    address: '9 Moshood Abiola Way, Garki, Abuja',
    hours: 'Mon–Fri, 9:00am – 6:00pm',
    phone: '+2348030003302',
    services: ['Drop-off', 'Collection'],
  },
  {
    id: 'abj-3',
    name: 'LOCI Gwarinpa Point',
    area: 'Gwarinpa',
    city: 'Abuja',
    address: '5th Avenue, Gwarinpa Estate, Abuja',
    hours: 'Mon–Sat, 9:00am – 7:00pm',
    phone: '+2348030003303',
    services: ['Drop-off'],
  },
  // ---- Other hubs ----
  {
    id: 'ph-1',
    name: 'LOCI Port Harcourt Hub',
    area: 'GRA Phase 2',
    city: 'Port Harcourt',
    address: '3 Aba Road, GRA Phase 2, Port Harcourt',
    hours: 'Mon–Fri, 9:00am – 6:00pm',
    phone: '+2348030004401',
    services: ['Drop-off', 'Collection'],
  },
];

/** Hubs in one city, in the order they were listed. */
export function hubsForCity(city: City): Hub[] {
  return HUBS.filter((hub) => hub.city === city);
}

/** Cities we have actually opened a hub in — 4 of the 37 today. */
export function citiesWithHubs(cities: readonly City[]): City[] {
  return cities.filter((city) => HUBS.some((hub) => hub.city === city));
}

export function findHub(id: string): Hub | undefined {
  return HUBS.find((hub) => hub.id === id);
}

/** "LOCI Ikeja Hub — Ikeja" */
export function hubLabel(hub: Hub): string {
  return `${hub.name} — ${hub.area}`;
}
