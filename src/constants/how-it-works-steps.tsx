import { KeyRound, PackageCheck, PackagePlus } from 'lucide-react-native';

import { STEP_ILLUSTRATIONS } from '@/constants/step-illustrations';

/**
 * The three process steps, in order. Single source of truth: the home-screen
 * cards and the `/how-it-works/[step]` detail pages both read from here, so the
 * summary and the expanded page can't drift apart.
 *
 * Titles mirror the wording that was baked into the top of each supplied
 * illustration. That band is cropped out of the `-art` files the cards use, so
 * these strings are now the only place the title is rendered — but keep them in
 * step with the originals in `assets/images/`, or the two tell different stories.
 *
 * NOTE: the one-time code (OTP) described below is not implemented anywhere in
 * the app — there is no code generation, delivery or verification in the store
 * or on any screen. This copy currently describes intended behaviour, not
 * shipped behaviour. Hubs are real (see `app/(tabs)/locations.tsx`), as are the
 * six stages in `BOOKING_STAGES`.
 */
export type StepKey = keyof typeof STEP_ILLUSTRATIONS;

/** Where a step's call-to-action leads. Each is a real screen. */
export type StepFeatureRoute = '/book' | '/locations' | '/my-packages';

export type ProcessStep = {
  key: StepKey;
  /** Zero-padded position, e.g. "01". */
  number: string;
  title: string;
  /** One-line summary, used on the home-screen card. */
  body: string;
  /** Expanded explanation, used on the detail page. */
  detail: string;
  benefits: { title: string; body: string }[];
  cta: { label: string; href: StepFeatureRoute };
  icon: (color: string, size: number) => React.ReactNode;
};

export const PROCESS_STEPS: ProcessStep[] = [
  {
    key: 'post-parcel',
    number: '01',
    title: 'POST PARCEL & SELECT PUBLIC HUB',
    body: 'Post your parcel, choose the pickup and destination hubs, and see the fare before you commit.',
    detail:
      'Pick the hub you are sending from and the hub it should arrive at, add the parcel weight and what is inside, and the fare appears before you confirm anything. Same-city deliveries are priced as local; anything crossing a state line is priced as inter-state. Nothing is posted until you confirm.',
    benefits: [
      {
        title: 'See the price first',
        body: 'The fare updates as you type, so there is no quote to wait for and no surprise at the hub.',
      },
      {
        title: 'Insurance built in',
        body: "Declare the parcel's value and cover is added at 1% — it's part of the quoted fare, not an upsell.",
      },
      {
        title: 'Hub or doorstep, your call',
        body: 'Hub to hub is the base price. Choose doorstep at either end and the fare shows the extra leg before you commit. Marking a parcel fragile is free.',
      },
    ],
    cta: { label: 'Post a Parcel', href: '/book' },
    icon: (color, size) => <PackagePlus color={color} size={size} />,
  },
  {
    key: 'handover-parcel',
    number: '02',
    title: 'HANDOVER PARCEL AT PICKUP HUB (OTP)',
    body: 'Drop the parcel at your pickup hub and confirm the handover with a one-time code.',
    detail:
      'Take the parcel to the hub you selected. A driver already travelling your route claims the job from the open feed, and the handover is confirmed with a one-time code so neither side has to take the other on trust. Once confirmed, the parcel moves from Booked to Assigned and the carrier’s name appears on your tracking card.',
    benefits: [
      {
        title: 'Matched by route',
        body: 'Drivers declare the journeys they are making, and your parcel is offered to someone already going that way.',
      },
      {
        title: 'Offered, not forced',
        body: 'A driver has to accept before your parcel is theirs — so someone has actually committed to carrying it, rather than been handed it.',
      },
      {
        title: 'Code-confirmed handover',
        body: 'The parcel changes hands against a one-time code, so no one can claim a pickup that never happened.',
      },
    ],
    cta: { label: 'Find a Pickup Hub', href: '/locations' },
    icon: (color, size) => <KeyRound color={color} size={size} />,
  },
  {
    key: 'recipient-collects',
    number: '03',
    title: 'RECIPIENT COLLECTS AT DESTINATION HUB (OTP)',
    body: 'Your recipient collects at the destination hub and releases the parcel with their own code.',
    detail:
      'Follow the parcel through six stages — Booked, Assigned, Picked Up, In Transit, Out for Delivery, Delivered — from the tracking card on your home screen. When it reaches the destination hub your recipient collects it in person and confirms with a one-time code, which closes the job and marks the parcel Delivered.',
    benefits: [
      {
        title: 'Six clear stages',
        body: 'Progress is a position on a known journey, not a vague status label.',
      },
      {
        title: 'Live from any screen',
        body: 'The ticker sits above every page, so you can see movement without going looking for it.',
      },
      {
        title: 'Collected by the right person',
        body: "Only someone with the recipient's code can release the parcel from the hub.",
      },
    ],
    cta: { label: 'Track Package', href: '/my-packages' },
    icon: (color, size) => <PackageCheck color={color} size={size} />,
  },
];

/** Lookup used by the dynamic route; returns undefined for an unknown slug. */
export function findStep(key: string | undefined): ProcessStep | undefined {
  return PROCESS_STEPS.find((step) => step.key === key);
}
