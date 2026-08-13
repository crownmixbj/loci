import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ArrowRight,
  Banknote,
  Building2,
  MapPin,
  Navigation,
  PackageOpen,
  PackagePlus,
  Receipt,
  ShieldAlert,
  StickyNote,
  Store,
  Tag,
  UserRound,
  Weight,
} from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { showDialog } from '@/components/ui/dialog';
import { useAuthGate } from '@/hooks/use-auth-gate';
import { useFormDraft } from '@/hooks/use-form-draft';
import { AreaPicker, resolveArea } from '@/components/ui/area-picker';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { SegmentedControl } from '@/components/ui/chip';
import { Dropdown, ToggleRow } from '@/components/ui/dropdown';
import { Field } from '@/components/ui/field';
import { ModeSelector, type ModeOption } from '@/components/ui/mode-selector';
import { PhotoPicker } from '@/components/ui/photo-picker';
import { LocationPicker } from '@/components/ui/location-picker';
import { SelectableUpgradeCard } from '@/components/ui/selectable-upgrade-card';
import { ValidatedPhoneInput } from '@/components/ValidatedPhoneInput';
import { screenPadding, ScreenHeader, SectionLabel } from '@/components/ui/screen';
import {FontSize, MaxContentWidth, Radius, Spacing, Typography, font } from '@/constants/theme';
import { findHub, hubLabel, hubsForCity, type Hub } from '@/constants/hubs';
import { useHubs } from '@/store/hubs';
import { HUB_COORDINATES } from '@/constants/hub-coordinates';
import { useTheme } from '@/hooks/use-theme';
import { isValidNigerianPhone, nigerianPhoneError } from '@/utils/validation';
import {
  areasForCity,
  CATEGORIES,
  cityHubLabel,
  CITIES,
  DEFAULT_CITY,
  DELIVERY_TYPES,
  estimateFee,
  formatAmountInput,
  dropoffSummaryLine,
  formatNaira,
  handoverModeLabel,
  parseAmountInput,
  pickupSummaryLine,
  PRICING,
  useBookings,
  type Category,
  type City,
  type DeliveryType,
  type HandoverMode,
} from '@/store/bookings';

/** Screen-local labels — more descriptive than the store's short badge labels. */
const DELIVERY_TYPE_TITLES: Record<DeliveryType, string> = {
  local: 'Local Delivery',
  interstate: 'Inter-State Delivery',
};

/**
 * Handover choices, with the price consequence stated on the option itself
 * rather than left to appear in the summary — the surcharge is the main reason
 * to pick one over the other.
 */
const DOORSTEP_BADGE = `+${formatNaira(PRICING.doorstepSurcharge)}`;

const PICKUP_MODES: readonly ModeOption<HandoverMode>[] = [
  {
    value: 'hub',
    label: 'LOCI hub',
    description: 'Driver to collect from the selected LOCI hub. Zero drop-off fees.',
    badge: 'Included',
  },
  {
    value: 'doorstep',
    label: 'Public location pickup',
    description: 'A driver collects from your proposed public location',
    badge: DOORSTEP_BADGE,
  },
];

/**
 * The dropoff end is one selectable card with a paid upgrade inside it, rather
 * than a radio pair: hub collection is what happens by default, and this card
 * is the only thing a sender changes.
 *
 * The card copy describes the free version, the upgrade copy describes what the
 * charge buys — keeping the two apart is what makes the two controls legible.
 */
const DOORSTEP_DROPOFF = {
  label: 'Deliver to recipient',
  description: 'A driver delivers to recipient at the proposed public location.',
  upgradeLabel: 'Home/Office Drop-off',
  upgradeHint:
    'Applies a supplementary charge for direct-to-door delivery instead of meeting at a public location.',
} as const;

type BookingForm = {
  deliveryType: DeliveryType;
  /** Where the parcel is collected from, and where it's handed over. */
  pickupMode: HandoverMode;
  dropoffMode: HandoverMode;
  originCity: City;
  destinationCity: City;
  /** Chosen LOCI hub id, used only when pickupMode is 'hub'. */
  pickupHubId: string;
  /** Dropdown selection — either a preset area or OTHER_AREA. */
  pickupAreaSelection: string;
  /** Free text, used only when the selection is OTHER_AREA. */
  pickupAreaCustom: string;
  pickupAddress: string;
  pickupContactName: string;
  senderPhone: string;
  dropoffAreaSelection: string;
  dropoffAreaCustom: string;
  dropoffAddress: string;
  recipientName: string;
  recipientPhone: string;
  /** Exact handover points, dropped on a map. Null until the sender places one. */
  pickupLat: number | null;
  pickupLng: number | null;
  dropoffLat: number | null;
  dropoffLng: number | null;
  itemDescription: string;
  /** Local URI from the picker, or '' when no photo is attached. */
  itemPhotoUri: string;
  category: Category;
  weight: string;
  declaredValue: string;
  fragile: boolean;
  notes: string;
};

type FieldErrors = Partial<Record<keyof BookingForm, string>>;

const INITIAL_FORM: BookingForm = {
  deliveryType: 'local',
  // Hub at both ends is the cheapest option, so it's the one we default to
  // rather than quietly opting people into a surcharge.
  pickupMode: 'hub',
  dropoffMode: 'hub',
  originCity: DEFAULT_CITY,
  destinationCity: DEFAULT_CITY,
  pickupHubId: '',
  pickupAreaSelection: '',
  pickupAreaCustom: '',
  pickupAddress: '',
  pickupContactName: '',
  senderPhone: '',
  dropoffAreaSelection: '',
  dropoffAreaCustom: '',
  dropoffAddress: '',
  recipientName: '',
  recipientPhone: '',
  pickupLat: null,
  pickupLng: null,
  dropoffLat: null,
  dropoffLng: null,
  itemDescription: '',
  itemPhotoUri: '',
  category: 'Electronics',
  weight: '',
  declaredValue: '',
  fragile: false,
  notes: '',
};

const normalizePhone = (value: string) => value.replace(/[\s()-]/g, '');

/**
 * Where the map opens before a pin exists.
 *
 * The city the sender already chose, not the geographic middle of Nigeria —
 * otherwise every sender starts by panning several hundred kilometres.
 */
function cityCenter(city: City): { lat: number; lng: number } {
  const point = HUB_COORDINATES[city];
  return { lat: point.lat, lng: point.lon };
}

/**
 * `hubs` is passed in rather than read from a module constant.
 *
 * Hubs are live data now — an admin can close one — so validation has to see
 * the same list the picker offered, or it would accept a hub that no longer
 * exists.
 */
function validate(form: BookingForm, hubs: Hub[]): FieldErrors {
  const errors: FieldErrors = {};

  // --- Item details ---
  const itemDescription = form.itemDescription.trim();
  if (!itemDescription) {
    errors.itemDescription = 'Give the item a name';
  } else if (itemDescription.length < 3) {
    errors.itemDescription = 'Add a little more detail';
  }

  if (!form.itemPhotoUri) {
    errors.itemPhotoUri = 'A photo of the parcel is required to confirm handover condition';
  }

  const weight = Number(form.weight);
  if (!form.weight.trim()) {
    errors.weight = 'Weight is required';
  } else if (Number.isNaN(weight) || weight <= 0) {
    errors.weight = 'Must be greater than 0';
  } else if (weight > 100) {
    errors.weight = 'Cannot exceed 100 kg';
  }

  if (form.declaredValue.trim()) {
    const declared = parseAmountInput(form.declaredValue);
    if (Number.isNaN(declared) || declared < 0) {
      errors.declaredValue = 'Enter a valid amount';
    } else if (declared > 10_000_000) {
      errors.declaredValue = 'Contact support for high-value items';
    }
  }

  // --- Locations ---
  const pickupArea = resolveArea(form.pickupAreaSelection, form.pickupAreaCustom);
  const dropoffArea = resolveArea(form.dropoffAreaSelection, form.dropoffAreaCustom);

  if (form.pickupMode === 'hub') {
    // The area comes from the chosen hub, so the hub is what's validated.
    if (!hubsForCity(hubs, form.originCity).length) {
      errors.pickupHubId = `No LOCI hub in ${form.originCity} yet — use public location pickup`;
    } else if (!form.pickupHubId) {
      errors.pickupHubId = 'Choose a LOCI hub';
    }
  } else if (!form.pickupAreaSelection) {
    errors.pickupAreaSelection = 'Choose a pickup area';
  } else if (!pickupArea) {
    errors.pickupAreaCustom = 'Name the pickup area';
  }

  if (!form.dropoffAreaSelection) {
    errors.dropoffAreaSelection = 'Choose a dropoff area';
  } else if (!dropoffArea) {
    errors.dropoffAreaCustom = 'Name the dropoff area';
  }

  if (form.deliveryType === 'local' && pickupArea && dropoffArea) {
    if (pickupArea.toLowerCase() === dropoffArea.toLowerCase()) {
      errors.dropoffAreaSelection = 'Pickup and dropoff areas are the same';
    }
  }

  // Only a doorstep leg needs a street address — for a hub drop-off the area
  // and the hub itself are enough to route the parcel.
  if (form.pickupMode === 'doorstep' && !form.pickupAddress.trim()) {
    errors.pickupAddress = 'Pickup address is required';
  }
  if (!form.pickupContactName.trim()) {
    errors.pickupContactName = 'Contact person is required';
  }

  const senderPhone = form.senderPhone.trim();
  if (!senderPhone) {
    errors.senderPhone = 'Pickup phone is required';
  } else if (!isValidNigerianPhone(senderPhone)) {
    errors.senderPhone = nigerianPhoneError(senderPhone) ?? 'Enter a valid Nigerian number';
  }

  if (form.dropoffMode !== 'hub' && !form.dropoffAddress.trim()) {
    errors.dropoffAddress =
      form.dropoffMode === 'doorstep' ? 'Dropoff address is required' : 'Name the meeting point';
  }
  if (!form.recipientName.trim()) {
    errors.recipientName = 'Recipient name is required';
  }

  const recipientPhone = form.recipientPhone.trim();
  if (!recipientPhone) {
    errors.recipientPhone = 'Recipient phone is required';
  } else if (!isValidNigerianPhone(recipientPhone)) {
    errors.recipientPhone = nigerianPhoneError(recipientPhone) ?? 'Enter a valid Nigerian number';
  }

  if (form.deliveryType === 'interstate' && form.originCity === form.destinationCity) {
    errors.destinationCity = 'Pick a different city, or switch to Local Delivery';
  }

  return errors;
}

/** Narrow a raw query-param string to a known union member. */
const asOption = <T extends string>(options: readonly T[], value: unknown): T | undefined =>
  typeof value === 'string' && (options as readonly string[]).includes(value)
    ? (value as T)
    : undefined;

export default function BookScreen() {
  const theme = useTheme();
  const { addBooking } = useBookings();
  const { requireAuth } = useAuthGate();
  const router = useRouter();
  const params = useLocalSearchParams<{
    service?: string;
    deliveryType?: string;
    focusDeclaredValue?: string;
    /** Set by "Select Hub" on the hub locations screen. */
    originCity?: string;
    pickupArea?: string;
  }>();

  const [form, setForm] = useState<BookingForm>(INITIAL_FORM);

  /*
   * Same reason as the driver application: the account is requested at submit,
   * so the app navigates away with a filled form and `useState` doesn't come
   * back. Four sections of typing is too much to lose at the last step.
   */
  const {
    draft,
    ready: draftReady,
    save: saveDraft,
    clear: clearDraft,
  } = useFormDraft<BookingForm>('loci.draft.booking');

  const restoredDraft = useRef(false);

  useEffect(() => {
    if (!draftReady || restoredDraft.current || !draft) return;
    restoredDraft.current = true;
    setForm(draft);
  }, [draftReady, draft]);

  useEffect(() => {
    if (!draftReady) return;
    saveDraft(form);
  }, [draftReady, form, saveDraft]);
  const [errors, setErrors] = useState<FieldErrors>({});

  const scrollRef = useRef<ScrollView>(null);
  const declaredValueRef = useRef<TextInput>(null);
  const itemCardY = useRef(0);
  /** Guards against re-applying the prefill on every re-render. */
  const appliedService = useRef<string | null>(null);
  const appliedHub = useRef<string | null>(null);

  /**
   * A hub chosen on the locations screen. Sets the origin city and the pickup
   * area, and switches the pickup end to hub drop-off — picking a hub is the
   * statement that you'll take the parcel there yourself.
   */
  useEffect(() => {
    const hubKey = `${params.originCity ?? ''}|${params.pickupArea ?? ''}`;
    if (!params.originCity || appliedHub.current === hubKey) return;
    appliedHub.current = hubKey;

    const originCity = asOption(CITIES, params.originCity);
    if (!originCity) return;

    setForm((prev) => {
      // Only offer the area if that city actually lists it; otherwise leave the
      // picker empty rather than selecting something that isn't in its options.
      const areas = areasForCity(originCity);
      const area = params.pickupArea && areas.includes(params.pickupArea) ? params.pickupArea : '';

      return {
        ...prev,
        pickupMode: 'hub',
        originCity,
        destinationCity: prev.deliveryType === 'local' ? originCity : prev.destinationCity,
        pickupAreaSelection: area,
        pickupAreaCustom: '',
      };
    });
  }, [params.originCity, params.pickupArea]);

  // Apply the service prefill handed over from the home screen's service sheet.
  useEffect(() => {
    const service = params.service;
    if (!service || appliedService.current === service) return;
    appliedService.current = service;

    const deliveryType = asOption(DELIVERY_TYPES, params.deliveryType);

    if (deliveryType) {
      setForm((prev) => ({
        ...prev,
        deliveryType,
        // Local keeps both ends on one city; see setDeliveryType.
        destinationCity: deliveryType === 'local' ? prev.originCity : prev.destinationCity,
      }));
    }

    if (params.focusDeclaredValue === '1') {
      // Wait for layout so the scroll target is measured.
      const timer = setTimeout(() => {
        scrollRef.current?.scrollTo({ y: Math.max(itemCardY.current - 12, 0), animated: true });
        declaredValueRef.current?.focus();
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [params.service, params.deliveryType, params.focusDeclaredValue]);

  const isLocal = form.deliveryType === 'local';

  // Resolved locations — these are what get stored and what the summary shows.
  const originArea = resolveArea(form.pickupAreaSelection, form.pickupAreaCustom);
  const destinationArea = resolveArea(form.dropoffAreaSelection, form.dropoffAreaCustom);
  const originLocation = originArea
    ? `${originArea}, ${form.originCity}`
    : cityHubLabel(form.originCity);
  const destinationLocation = destinationArea
    ? `${destinationArea}, ${isLocal ? form.originCity : form.destinationCity}`
    : cityHubLabel(isLocal ? form.originCity : form.destinationCity);

  // Live quote — recalculates as the sender types or flips any of the toggles.
  const fee = useMemo(
    () =>
      estimateFee({
        deliveryType: form.deliveryType,
        weight: Number(form.weight),
        declaredValue: parseAmountInput(form.declaredValue),
        pickupMode: form.pickupMode,
        dropoffMode: form.dropoffMode,
      }),
    [form.deliveryType, form.weight, form.declaredValue, form.pickupMode, form.dropoffMode],
  );

  const { hubs: allHubs } = useHubs();

  const cityHubs = useMemo(() => hubsForCity(allHubs, form.originCity), [allHubs, form.originCity]);

  /**
   * Picking a hub sets the area too. `pickupArea` is what the route label, the
   * driver feed and the local same-area check all read, so leaving it empty
   * would break them — the hub is the more specific fact, the area is derived.
   */
  const selectHub = (hubId: string) => {
    const hub = findHub(allHubs, hubId);
    if (!hub) return;

    setForm((prev) => ({
      ...prev,
      pickupHubId: hubId,
      pickupAreaSelection: hub.area,
      pickupAreaCustom: '',
    }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next.pickupHubId;
      delete next.pickupAreaSelection;
      return next;
    });
  };

  /**
   * How each end reads in the summary. The handover mode leads, because that's
   * what decides both where the parcel changes hands and what it costs; the
   * place follows.
   */
  const pickupSummary = useMemo(() => {
    const hub = form.pickupMode === 'hub' ? findHub(allHubs, form.pickupHubId) : undefined;
    if (form.pickupMode === 'hub' && !hub) {
      return `${handoverModeLabel('hub', 'pickup')} · not chosen yet (${form.originCity})`;
    }
    return pickupSummaryLine({
      mode: form.pickupMode,
      // In hub mode the hub itself is the address, stored on the booking in
      // exactly this shape — so this screen and the confirmation read alike.
      address: hub ? `${hub.name}, ${hub.address}` : form.pickupAddress,
      area: hub ? '' : originArea,
      city: form.originCity,
    });
  }, [form.pickupMode, form.pickupHubId, form.pickupAddress, form.originCity, originArea]);

  const dropoffSummary = useMemo(
    () =>
      dropoffSummaryLine({
        mode: form.dropoffMode,
        address: form.dropoffAddress,
        area: destinationArea,
        city: isLocal ? form.originCity : form.destinationCity,
      }),
    [
      form.dropoffMode,
      form.dropoffAddress,
      form.originCity,
      form.destinationCity,
      destinationArea,
      isLocal,
    ],
  );

  const setField = <K extends keyof BookingForm>(key: K, value: BookingForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  /**
   * Switching to Local collapses both cities onto the origin. Any dropoff area
   * chosen for the old destination city is cleared, since area lists are
   * city-specific.
   */
  const setDeliveryType = (deliveryType: DeliveryType) => {
    setForm((prev) => {
      if (deliveryType === prev.deliveryType) return prev;

      const collapsing = deliveryType === 'local' && prev.destinationCity !== prev.originCity;
      return {
        ...prev,
        deliveryType,
        destinationCity: deliveryType === 'local' ? prev.originCity : prev.destinationCity,
        ...(collapsing && { dropoffAreaSelection: '', dropoffAreaCustom: '' }),
      };
    });
    setErrors({});
  };

  /** In Local mode the single city selector drives both ends of the route. */
  const setOriginCity = (city: City) => {
    // A hub in the old city can't survive the change.
    setForm((prev) => (prev.pickupHubId ? { ...prev, pickupHubId: '' } : prev));
    setForm((prev) => {
      if (city === prev.originCity) return prev;
      const isLocalMode = prev.deliveryType === 'local';

      return {
        ...prev,
        originCity: city,
        // Pickup areas belong to the origin city, so they can't survive the change.
        pickupAreaSelection: '',
        pickupAreaCustom: '',
        ...(isLocalMode && {
          destinationCity: city,
          dropoffAreaSelection: '',
          dropoffAreaCustom: '',
        }),
      };
    });
    setErrors({});
  };

  const setDestinationCity = (city: City) => {
    setForm((prev) => {
      if (city === prev.destinationCity) return prev;
      return { ...prev, destinationCity: city, dropoffAreaSelection: '', dropoffAreaCustom: '' };
    });
    setErrors((prev) => ({ ...prev, destinationCity: undefined }));
  };

  const handleSubmit = () => {
    const nextErrors = validate(form, allHubs);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      showDialog('Check the form', 'Some required details are missing or invalid.');
      return;
    }

    /*
     * Validate first, then ask for an account. The other order — gate on entry —
     * makes someone sign in before they know whether their parcel is even
     * bookable, and loses everything they typed if they bounce out. Here the
     * form is already complete and the state survives the round trip.
     */
    requireAuth(() => void postParcel(), {
      title: 'Sign in to post this parcel',
      reason:
        'A parcel needs an owner: it is how you track it, and how the driver knows who to call at pickup. Your details stay filled in.',
      next: '/book',
    });
  };

  /** Runs only once we know who is posting. */
  const postParcel = async () => {
    // TODO: replace with an API call; the store is the local source of truth for now.
    const booking = await addBooking({
      deliveryType: form.deliveryType,
      pickupMode: form.pickupMode,
      dropoffMode: form.dropoffMode,
      originCity: form.originCity,
      destinationCity: isLocal ? form.originCity : form.destinationCity,
      pickupArea: originArea,
      // Hub legs have no address field on screen, so don't carry over a stale
      // one the sender typed before switching mode.
      /*
        A hub pickup does have an address — the hub's. Storing it means the
        driver's job card names the place rather than just the neighbourhood.
      */
      pickupAddress:
        form.pickupMode === 'doorstep'
          ? form.pickupAddress.trim()
          : (() => {
              const hub = findHub(allHubs, form.pickupHubId);
              return hub ? `${hub.name}, ${hub.address}` : '';
            })(),
      dropoffArea: destinationArea,
      dropoffAddress: form.dropoffMode === 'hub' ? '' : form.dropoffAddress.trim(),
      pickupLat: form.pickupLat,
      pickupLng: form.pickupLng,
      dropoffLat: form.dropoffLat,
      dropoffLng: form.dropoffLng,
      pickupContactName: form.pickupContactName.trim(),
      senderPhone: normalizePhone(form.senderPhone),
      recipientName: form.recipientName.trim(),
      recipientPhone: normalizePhone(form.recipientPhone),
      itemDescription: form.itemDescription.trim(),
      itemPhotoUri: form.itemPhotoUri || null,
      category: form.category,
      weight: Number(form.weight),
      declaredValue: parseAmountInput(form.declaredValue) || 0,
      fragile: form.fragile,
      notes: form.notes.trim(),
      estimatedFee: fee.total,
    });

    /*
     * The insert can fail — offline, RLS refusal, a duplicate tracking id. Bail
     * before clearing the form, or a network blip silently destroys four
     * sections of typing. `error` on the store carries the reason.
     */
    if (!booking) {
      showDialog(
        'Could not post the parcel',
        'Your details are still here. Check your connection and try again.',
      );
      return;
    }

    // Posted and stored — the draft has done its job.
    void clearDraft();
    setForm(INITIAL_FORM);
    setErrors({});

    /*
      A confirmation screen rather than an alert: this form is four sections
      long, and an OS dialog that vanishes on tap is a poor place to put the
      one number the sender needs to keep. `replace` so the back gesture can't
      return to a submitted form and post it twice.
    */
    router.replace({
      pathname: '/parcel-confirmed',
      params: { trackingId: booking.trackingId },
    });
  };

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.container, screenPadding]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag">
        <View style={styles.content}>
          <ScreenHeader
            brand={false}
            title="Post a Parcel"
            subtitle="Four short sections. You'll see the fee before you confirm."
          />

          {/* 1 — Delivery type */}
          <View>
            <SectionLabel>Delivery type</SectionLabel>
            <SegmentedControl
              options={DELIVERY_TYPES}
              selected={form.deliveryType}
              onSelect={setDeliveryType}
              renderLabel={(type) => DELIVERY_TYPE_TITLES[type]}
            />
            <Text style={[styles.hint, { color: theme.textMuted }]}>
              {isLocal
                ? `Within one city · base ${formatNaira(PRICING.base.local)} + ${formatNaira(PRICING.perKg.local)}/kg`
                : `Between two cities · base ${formatNaira(PRICING.base.interstate)} + ${formatNaira(PRICING.perKg.interstate)}/kg`}
            </Text>
          </View>

          {/* 2 — Item details */}
          <Card
            style={styles.card}
            onLayout={(event) => {
              itemCardY.current = event.nativeEvent.layout.y;
            }}>
            <SectionHeading
              icon={<PackageOpen color={theme.primary} size={18} />}
              title="Item details"
            />

            <Field
              label="Item title"
              icon={(color, size) => <Tag color={color} size={size} />}
              placeholder="Laptop charger and cables"
              value={form.itemDescription}
              onChangeText={(text) => setField('itemDescription', text)}
              error={errors.itemDescription}
            />

            <Dropdown
              label="Category"
              options={CATEGORIES}
              selected={form.category}
              onSelect={(value) => setField('category', value)}
              icon={(color, size) => <PackageOpen color={color} size={size} />}
            />

            {/*
              Required. This form marks optional fields and leaves required ones
              plain, so there is no asterisk here — adding one to a single field
              would imply everything else is optional.
            */}
            <PhotoPicker
              label="Photo of the parcel"
              hint="Confirms the parcel's condition at handover and collection."
              value={form.itemPhotoUri}
              onChange={(uri) => setField('itemPhotoUri', uri)}
              error={errors.itemPhotoUri}
            />

            <View style={styles.row}>
              <View style={styles.rowItem}>
                <Field
                  label="Weight (kg)"
                  icon={(color, size) => <Weight color={color} size={size} />}
                  placeholder="2.5"
                  value={form.weight}
                  onChangeText={(text) => setField('weight', text)}
                  error={errors.weight}
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={styles.rowItem}>
                <Field
                  inputRef={declaredValueRef}
                  label="Declared value (₦)"
                  icon={(color, size) => <Banknote color={color} size={size} />}
                  placeholder="45,000"
                  value={form.declaredValue}
                  onChangeText={(text) => setField('declaredValue', formatAmountInput(text))}
                  error={errors.declaredValue}
                  hint={errors.declaredValue ? undefined : 'For insurance'}
                  keyboardType="number-pad"
                />
              </View>
            </View>

            <ToggleRow
              label="Fragile / Handle with care"
              description="Flags the job for drivers to ensure careful handling at no extra cost"
              value={form.fragile}
              onValueChange={(value) => setField('fragile', value)}
              icon={(color, size) => <ShieldAlert color={color} size={size} />}
            />
          </Card>

          {/* 3 — Locations & route */}
          <Card style={styles.card}>
            <SectionHeading icon={<MapPin color={theme.primary} size={18} />} title="Pickup" />

            <ModeSelector
              label="How should a driver pick up the item(s)?"
              value={form.pickupMode}
              options={PICKUP_MODES}
              onChange={(value) => setField('pickupMode', value)}
            />

            <Dropdown
              label={isLocal ? 'Select city' : 'Origin hub'}
              options={CITIES}
              selected={form.originCity}
              onSelect={setOriginCity}
              renderLabel={cityHubLabel}
              icon={(color, size) => <Building2 color={color} size={size} />}
              // 37 cities — scrolling to "Yola" is a long way down.
              searchable
              searchPlaceholder="Search city or state"
            />

            {/*
              Hub mode offers the actual partner hubs in the selected city, not
              neighbourhoods — the label promised LOCI locations, so the options
              have to be LOCI locations. Public-location pickup keeps the area
              picker, where naming a neighbourhood is the right question.
            */}
            {form.pickupMode === 'hub' ? (
              cityHubs.length > 0 ? (
                <Dropdown
                  label="Pickup LOCI area"
                  options={cityHubs.map((hub) => hub.id)}
                  selected={form.pickupHubId}
                  onSelect={selectHub}
                  renderLabel={(id) => {
                    const hub = findHub(allHubs, id);
                    return hub ? hubLabel(hub) : id;
                  }}
                  placeholder={`Choose a hub in ${form.originCity}`}
                  icon={(color, size) => <Store color={color} size={size} />}
                  /*
                    Matching runs on the rendered label — "LOCI Bodija Hub —
                    Bodija" — so typing either the hub name or the neighbourhood
                    finds it, which is how someone would actually look.
                  */
                  searchable
                  searchPlaceholder="Search hub or area"
                  error={errors.pickupHubId}
                />
              ) : (
                /*
                  33 of the 37 cities have no hub yet. Rather than an empty
                  dropdown, say so and offer the one action that unblocks them.
                */
                <View style={[styles.noHubs, { backgroundColor: theme.warningSoft }]}>
                  <Store color={theme.warningOnSoft} size={16} />
                  <View style={styles.noHubsText}>
                    <Text style={[styles.noHubsTitle, { color: theme.warningOnSoft }]}>
                      No LOCI hub in {form.originCity} yet
                    </Text>
                    <Text style={[styles.noHubsBody, { color: theme.warningOnSoft }]}>
                      Switch to public location pickup and a driver will collect from a spot you
                      choose, or pick a different origin city.
                    </Text>
                    <Button
                      label="Use public location pickup"
                      size="md"
                      variant="secondary"
                      style={styles.noHubsCta}
                      onPress={() => setField('pickupMode', 'doorstep')}
                    />
                  </View>
                </View>
              )
            ) : (
              <AreaPicker
                label="Pickup area"
                city={form.originCity}
                selection={form.pickupAreaSelection}
                onSelectionChange={(value) => setField('pickupAreaSelection', value)}
                customValue={form.pickupAreaCustom}
                onCustomChange={(value) => setField('pickupAreaCustom', value)}
                error={errors.pickupAreaSelection ?? errors.pickupAreaCustom}
              />
            )}

            {/* A hub drop-off has no street address to collect from. */}
            {form.pickupMode === 'doorstep' && (
              <Field
                label="Pickup address"
                icon={(color, size) => <MapPin color={color} size={size} />}
                placeholder="12 Awolowo Avenue"
                value={form.pickupAddress}
                onChangeText={(text) => setField('pickupAddress', text)}
                error={errors.pickupAddress}
                multiline
              />
            )}

            {/* Only for a public-location pickup — a hub already has an address. */}
            {form.pickupMode !== 'hub' && (
              <LocationPicker
                label="Pickup point on the map"
                hint="Optional, but it's what lets the driver find you rather than the street."
                tone="pickup"
                lat={form.pickupLat}
                lng={form.pickupLng}
                center={cityCenter(form.originCity)}
                onChange={(position) => {
                  setField('pickupLat', position?.lat ?? null);
                  setField('pickupLng', position?.lng ?? null);
                }}
              />
            )}

            <Field
              label={form.pickupMode === 'hub' ? 'Who is dropping it off?' : 'Contact person'}
              icon={(color, size) => <UserRound color={color} size={size} />}
              placeholder="Who hands over the parcel"
              value={form.pickupContactName}
              onChangeText={(text) => setField('pickupContactName', text)}
              error={errors.pickupContactName}
              autoCapitalize="words"
            />

            {/*
              At a hub the sender brings the parcel in, so "Pickup phone" names
              a collection that isn't happening. The number is the same contact
              either way.
            */}
            <ValidatedPhoneInput
              label={form.pickupMode === 'hub' ? 'Phone number' : 'Pickup phone'}
              value={form.senderPhone}
              onChangeText={(text) => setField('senderPhone', text)}
              showError={Boolean(errors.senderPhone)}
            />
          </Card>

          <Card style={styles.card}>
            <SectionHeading icon={<Navigation color={theme.success} size={18} />} title="Dropoff" />

            {/*
              Hub collection is the default and needs no control — it's what
              happens unless the sender opts into a door run. The toggle below
              is the only choice, so a radio pair would have been two controls
              for one decision.
            */}
            <View style={[styles.defaultNote, { backgroundColor: theme.surfaceMuted }]}>
              <Building2 color={theme.textSecondary} size={16} />
              <Text style={[styles.defaultNoteText, { color: theme.textSecondary }]}>
                <Text style={[styles.defaultNoteValue, { color: theme.text }]}>
                  LOCI hub (OTP Collection)
                </Text>{' '}
                — This only if uncollected, parcel will be moved to the LOCI hub. This transfer may
                incur a mileage-based surcharge
              </Text>
            </View>

            {/*
              Two independent states over one field:
                unselected        -> 'hub'        ₦0
                selected, off     -> 'meetpoint'  ₦0
                selected, on      -> 'doorstep'   +₦800
              Selecting the card never turns the switch on, so choosing delivery
              to the recipient cannot silently add a fee.
            */}
            <SelectableUpgradeCard
              label={DOORSTEP_DROPOFF.label}
              description={DOORSTEP_DROPOFF.description}
              selected={form.dropoffMode !== 'hub'}
              onSelectedChange={(on) => setField('dropoffMode', on ? 'meetpoint' : 'hub')}
              upgraded={form.dropoffMode === 'doorstep'}
              onUpgradedChange={(on) => setField('dropoffMode', on ? 'doorstep' : 'meetpoint')}
              upgradeLabel={DOORSTEP_DROPOFF.upgradeLabel}
              upgradeHint={DOORSTEP_DROPOFF.upgradeHint}
              badge={DOORSTEP_BADGE}
              icon={(color, size) => <Navigation color={color} size={size} />}
            />

            {isLocal ? (
              <View style={[styles.lockedCity, { backgroundColor: theme.surfaceMuted }]}>
                <Building2 color={theme.textSecondary} size={16} />
                <Text style={[styles.lockedCityText, { color: theme.textSecondary }]}>
                  Same city —{' '}
                  <Text style={[styles.lockedCityValue, { color: theme.text }]}>
                    {cityHubLabel(form.originCity)}
                  </Text>
                </Text>
              </View>
            ) : (
              <Dropdown
                label="Destination hub"
                options={CITIES}
                selected={form.destinationCity}
                onSelect={setDestinationCity}
                renderLabel={cityHubLabel}
                icon={(color, size) => <Building2 color={color} size={size} />}
                searchable
                searchPlaceholder="Search city or state"
                error={errors.destinationCity}
                // An inter-state trip can't start and end in the same hub.
                disabledOptions={[form.originCity]}
                disabledHint="Already your origin"
              />
            )}

            <AreaPicker
              label="Dropoff area"
              city={isLocal ? form.originCity : form.destinationCity}
              selection={form.dropoffAreaSelection}
              onSelectionChange={(value) => setField('dropoffAreaSelection', value)}
              customValue={form.dropoffAreaCustom}
              onCustomChange={(value) => setField('dropoffAreaCustom', value)}
              error={errors.dropoffAreaSelection ?? errors.dropoffAreaCustom}
            />

            {/*
              Hub collection needs no address — the recipient comes to us. Both
              other modes need somewhere to go, so the field follows the card's
              selected state rather than the upgrade switch.
            */}
            {form.dropoffMode !== 'hub' && (
              <Field
                label={form.dropoffMode === 'doorstep' ? 'Dropoff address' : 'Meeting point'}
                icon={(color, size) => <Navigation color={color} size={size} />}
                placeholder={
                  form.dropoffMode === 'doorstep'
                    ? '45 Allen Avenue'
                    : 'Total filling station, Allen Avenue'
                }
                value={form.dropoffAddress}
                onChangeText={(text) => setField('dropoffAddress', text)}
                error={errors.dropoffAddress}
                multiline
              />
            )}

            {/*
              Optional, and only where a pin means something: a hub drop-off is
              already a known location with a known address.
            */}
            {form.dropoffMode !== 'hub' && (
              <LocationPicker
                label="Drop-off point on the map"
                hint="Optional, but it's what lets the driver navigate to the exact spot."
                tone="dropoff"
                lat={form.dropoffLat}
                lng={form.dropoffLng}
                center={cityCenter(isLocal ? form.originCity : form.destinationCity)}
                onChange={(position) => {
                  setField('dropoffLat', position?.lat ?? null);
                  setField('dropoffLng', position?.lng ?? null);
                }}
              />
            )}

            <Field
              label="Recipient name"
              icon={(color, size) => <UserRound color={color} size={size} />}
              placeholder="Ada Obi"
              value={form.recipientName}
              onChangeText={(text) => setField('recipientName', text)}
              error={errors.recipientName}
              autoCapitalize="words"
            />

            <ValidatedPhoneInput
              label="Recipient phone"
              value={form.recipientPhone}
              onChangeText={(text) => setField('recipientPhone', text)}
              showError={Boolean(errors.recipientPhone)}
            />

            <Field
              label="Delivery notes (optional)"
              icon={(color, size) => <StickyNote color={color} size={size} />}
              placeholder="Call on arrival, leave with security..."
              value={form.notes}
              onChangeText={(text) => setField('notes', text)}
              multiline
            />
          </Card>

          {/* 4 — Summary & cost estimate */}
          <Card style={[styles.card, styles.summaryCard, { borderColor: theme.primary }]}>
            <View style={styles.summaryHeader}>
              <SectionHeading
                icon={<Receipt color={theme.primary} size={18} />}
                title="Delivery summary"
              />
              <Badge
                label={isLocal ? 'Local' : 'Inter-State'}
                tone={isLocal ? 'success' : 'primary'}
              />
            </View>

            <View style={styles.summaryRouteRow}>
              <Text style={[styles.summaryRoute, { color: theme.text }]} numberOfLines={2}>
                {originLocation}
              </Text>
              <ArrowRight color={theme.primary} size={16} />
              <Text style={[styles.summaryRoute, { color: theme.text }]} numberOfLines={2}>
                {destinationLocation}
              </Text>
            </View>

            <View style={[styles.divider, { backgroundColor: theme.border }]} />

            {/*
              A full read-back of the form, so the last thing before Confirm
              shows everything that's about to be posted rather than just the
              route and the price. Rows that have nothing to say are omitted —
              an empty "Notes: —" is noise, not reassurance.
            */}
            <ReviewRow
              icon={<PackageOpen color={theme.textMuted} size={14} />}
              label="Item"
              value={
                [
                  form.itemDescription.trim() || 'Not named yet',
                  form.category,
                  form.weight.trim() ? `${form.weight.trim()} kg` : null,
                ]
                  .filter(Boolean)
                  .join(' · ') + (form.fragile ? ' · Fragile' : '')
              }
            />
            <ReviewRow
              icon={<Banknote color={theme.textMuted} size={14} />}
              label="Declared"
              value={
                form.declaredValue.trim()
                  ? `${formatNaira(parseAmountInput(form.declaredValue))} — insured`
                  : 'Not declared — travels uninsured'
              }
            />
            <ReviewRow
              icon={<Tag color={theme.textMuted} size={14} />}
              label="Photo"
              value={form.itemPhotoUri ? 'Attached' : 'Not attached yet'}
            />

            <View style={[styles.divider, { backgroundColor: theme.border }]} />

            <ReviewRow
              icon={<MapPin color={theme.textMuted} size={14} />}
              label="Pickup"
              value={pickupSummary}
            />
            {!!form.pickupContactName.trim() && (
              <ReviewRow
                icon={<UserRound color={theme.textMuted} size={14} />}
                label={form.pickupMode === 'hub' ? 'Dropping off' : 'Contact'}
                value={
                  form.pickupContactName.trim() +
                  (form.senderPhone.trim() ? ` · ${form.senderPhone.trim()}` : '')
                }
              />
            )}
            <ReviewRow
              icon={<Navigation color={theme.textMuted} size={14} />}
              label="Dropoff"
              value={dropoffSummary}
            />
            {!!form.recipientName.trim() && (
              <ReviewRow
                icon={<UserRound color={theme.textMuted} size={14} />}
                label="Recipient"
                value={
                  form.recipientName.trim() +
                  (form.recipientPhone.trim() ? ` · ${form.recipientPhone.trim()}` : '')
                }
              />
            )}
            {!!form.notes.trim() && (
              <ReviewRow
                icon={<StickyNote color={theme.textMuted} size={14} />}
                label="Notes"
                value={form.notes.trim()}
              />
            )}

            <View style={[styles.divider, { backgroundColor: theme.border }]} />

            <CostRow label={`Base fare · ${isLocal ? 'Local' : 'Inter-State'}`} value={fee.base} />
            <CostRow
              label={`Weight · ${form.weight.trim() || 0} kg × ${formatNaira(PRICING.perKg[form.deliveryType])}`}
              value={fee.weight}
            />
            {fee.insurance > 0 && (
              <CostRow label="Insurance · 1% of declared value" value={fee.insurance} />
            )}
            {/* Absent entirely at hub-to-hub, which is the point of the line. */}
            {fee.doorstep > 0 && (
              <CostRow
                label={`Doorstep · ${fee.doorstepLegs === 2 ? 'pickup and delivery' : fee.doorstepLegs === 1 && form.pickupMode === 'doorstep' ? 'pickup' : 'delivery'}`}
                value={fee.doorstep}
              />
            )}

            <View style={[styles.divider, { backgroundColor: theme.border }]} />

            <View style={styles.totalRow}>
              <Text style={[styles.totalLabel, { color: theme.text }]}>Estimated total</Text>
              <Text style={[styles.totalValue, { color: theme.primary }]}>
                {formatNaira(fee.total)}
              </Text>
            </View>
            <Text style={[styles.disclaimer, { color: theme.textMuted }]}>
              Estimate only. Final fare is confirmed when a driver accepts.
            </Text>
          </Card>

          {/* 5 — Action */}
          <Button
            label="Confirm & Post Parcel"
            icon={(color, size) => <PackagePlus color={color} size={size} />}
            onPress={handleSubmit}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function SectionHeading({ icon, title }: { icon: React.ReactNode; title: string }) {
  const theme = useTheme();
  return (
    <View style={styles.sectionHeading}>
      {icon}
      <Text style={[styles.sectionTitle, { color: theme.text }]}>{title}</Text>
    </View>
  );
}

/** One read-back line in the summary. Wraps rather than truncating — a hub
 *  address or a set of delivery notes is worth seeing in full before posting. */
function ReviewRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  const theme = useTheme();

  return (
    <View style={styles.reviewRow}>
      <View style={styles.reviewIcon}>{icon}</View>
      <Text style={[styles.reviewLabel, { color: theme.textMuted }]}>{label}</Text>
      <Text style={[styles.reviewValue, { color: theme.text }]}>{value}</Text>
    </View>
  );
}

function CostRow({ label, value }: { label: string; value: number }) {
  const theme = useTheme();
  return (
    <View style={styles.costRow}>
      <Text style={[styles.costLabel, { color: theme.textSecondary }]} numberOfLines={1}>
        {label}
      </Text>
      <Text style={[styles.costValue, { color: theme.text }]}>{formatNaira(value)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
    alignItems: 'center',
  },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    gap: Spacing.three,
  },
  hint: {
    ...Typography.meta,
    marginTop: Spacing.two,
  },
  card: {
    gap: Spacing.three,
  },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  sectionTitle: {
    ...Typography.sectionTitle,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.three - 4,
  },
  rowItem: {
    flex: 1,
  },
  noHubs: {
    flexDirection: 'row',
    gap: Spacing.three - 4,
    padding: Spacing.three,
    borderRadius: Radius.md,
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
    borderLeftWidth: 3,
    borderLeftColor: '#B45309',
  },
  noHubsText: {
    flex: 1,
    gap: Spacing.one,
  },
  noHubsTitle: {
    ...Typography.body,
    ...font(700),
  },
  noHubsBody: {
    ...Typography.caption,
    lineHeight: 19,
  },
  noHubsCta: {
    alignSelf: 'flex-start',
    marginTop: Spacing.two,
  },
  lockedCity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.three - 2,
    paddingVertical: Spacing.two + 2,
  },
  /** States the no-cost default that the doorstep toggle opts out of. */
  defaultNote: {
    flexDirection: 'row',
    // Top-aligned: this wraps to two or three lines, unlike lockedCity.
    alignItems: 'flex-start',
    gap: Spacing.two,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.three - 2,
    paddingVertical: Spacing.two + 2,
  },
  defaultNoteText: {
    flex: 1,
    ...Typography.meta,
    lineHeight: 18,
  },
  defaultNoteValue: {
    ...font(700),
  },
  lockedCityText: {
    ...Typography.meta,
  },
  lockedCityValue: {
    ...font(700),
  },
  pickerField: {
    gap: Spacing.two - 2,
  },
  pickerLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one + 2,
  },
  pickerLabel: {
    ...Typography.label,
  },
  errorText: {
    ...Typography.meta,
  },
  summaryCard: {
    borderWidth: 1,
    gap: Spacing.two,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  reviewRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  reviewIcon: {
    width: 16,
    alignItems: 'center',
    paddingTop: 2,
  },
  reviewLabel: {
    ...Typography.caption,
    width: 76,
  },
  reviewValue: {
    flex: 1,
    ...Typography.caption,
    ...font(600),
  },
  summaryRouteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  summaryRoute: {
    ...Typography.body,
    ...font(600),
    flex: 1,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: Spacing.one,
  },
  costRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  costLabel: {
    ...Typography.meta,
    flexShrink: 1,
  },
  costValue: {
    ...Typography.meta,
    ...font(600),
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  totalLabel: {
    ...Typography.sectionTitle,
  },
  totalValue: {
    fontSize: FontSize.heading,
    ...font(700),
  },
  disclaimer: {
    ...Typography.meta,
  },
});
