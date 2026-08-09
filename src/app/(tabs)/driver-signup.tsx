import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import {
  Bike,
  Building2,
  Car,
  Check,
  CheckCircle2,
  CircleCheckBig,
  ClipboardCheck,
  Clock,
  FileCheck2,
  Banknote,
  Hash,
  HeartPulse,
  Landmark,
  LayoutDashboard,
  LogIn,
  MapPin,
  IdCard,
  Mail,
  PhoneCall,
  Truck,
  Upload,
  UserCheck,
  UserRound,
} from 'lucide-react-native';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { showDialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ChipGroup } from '@/components/ui/chip';
import { Dropdown } from '@/components/ui/dropdown';
import { Field } from '@/components/ui/field';
import { ValidatedEmailInput } from '@/components/ValidatedEmailInput';
import { ValidatedPhoneInput } from '@/components/ValidatedPhoneInput';
import { isValidNigerianPhone, nigerianPhoneError } from '@/utils/validation';
import { SectionLabel } from '@/components/ui/screen';
import { MaxContentWidth, PageCanvas, Radius, Spacing, Typography, font } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  isValidEmail,
  isValidLicenceId,
  isValidNin,
  isValidNuban,
  isValidPlateNumber,
  GUARANTOR_RELATIONSHIPS,
  LICENCE_LENGTH,
  NEXT_OF_KIN_RELATIONSHIPS,
  NIGERIAN_BANKS,
  NUBAN_LENGTH,
  NIN_LENGTH,
} from '@/constants/driver-validation';
import { DEFAULT_STATE, NIGERIA_STATES, type NigeriaState } from '@/constants/nigeriaStates';
import { cityForState } from '@/store/bookings';
import { useSession } from '@/store/session';
import { useAuthGate } from '@/hooks/use-auth-gate';

const VEHICLE_TYPES = ['Motorcycle', 'Car', 'Van', 'Truck'] as const;
type VehicleType = (typeof VEHICLE_TYPES)[number];

const VEHICLE_ICONS: Record<VehicleType, typeof Truck> = {
  Motorcycle: Bike,
  Car: Car,
  Van: Truck,
  Truck: Truck,
};

/**
 * Documents the applicant must attach, in the order they're shown. Mocked — no
 * file picker is wired up.
 *
 * The list drives the rows, the state map, the validation loop and the mock
 * filenames, so adding one here is enough — there is nowhere else to register
 * a document.
 */
const DOCUMENTS = [
  {
    key: 'license',
    label: "Driver's licence",
    hint: 'Front and back, clearly readable',
    file: 'drivers-licence',
  },
  {
    key: 'id',
    label: "Driver's government ID",
    hint: "NIN slip, International Passport, or Voter's Card",
    file: 'driver-government-id',
  },
  {
    key: 'guarantorId',
    label: "Guarantor's government ID",
    hint: "NIN slip, National ID card, or Voter's Card",
    file: 'guarantor-government-id',
  },
  {
    key: 'vehicle',
    label: 'Vehicle picture',
    hint: 'Side-on, with the plate visible',
    file: 'vehicle-photo',
  },
  {
    key: 'insurance',
    label: 'Car insurance',
    hint: 'Valid certificate, showing the policy expiry date',
    file: 'car-insurance',
  },
] as const;

type DocumentKey = (typeof DOCUMENTS)[number]['key'];

type SignupForm = {
  fullName: string;
  phone: string;
  email: string;
  /** Required — pairs with the Government ID upload. */
  nin: string;
  /** The applicant's own residential or office address. */
  address: string;
  /** One of the 37, from `NIGERIA_STATES`. */
  state: NigeriaState;
  vehicleType: VehicleType;
  plateNumber: string;
  licenseId: string;

  // Guarantor — someone who vouches for the applicant.
  guarantorName: string;
  guarantorPhone: string;
  guarantorRelationship: GuarantorRelationship;
  guarantorAddress: string;
  /** Optional — blank is valid; 11 digits when supplied. */
  guarantorNin: string;

  // Where payouts land.
  bankName: BankName;
  accountNumber: string;
  accountName: string;

  // Next of kin, for emergencies.
  kinName: string;
  kinPhone: string;
  kinRelationship: KinRelationship;
};

type GuarantorRelationship = (typeof GUARANTOR_RELATIONSHIPS)[number];
type KinRelationship = (typeof NEXT_OF_KIN_RELATIONSHIPS)[number];
type BankName = (typeof NIGERIAN_BANKS)[number];

/** An attached document. `uri` is a local file path — nothing is uploaded yet. */
type AttachedDocument = { fileName: string; uri: string; size: number | null } | null;

/** Rejected client-side so a 40 MB scan doesn't sit in memory waiting for a backend. */
const MAX_DOCUMENT_MB = 10;
const MAX_DOCUMENT_BYTES = MAX_DOCUMENT_MB * 1024 * 1024;

/**
 * Empty attachment map, derived from `DOCUMENTS` rather than written out. Two
 * hand-written copies of this had already drifted apart once; deriving it means
 * adding a slot can't leave one of them short a key.
 */
const NO_DOCUMENTS = Object.fromEntries(DOCUMENTS.map((doc) => [doc.key, null])) as Record<
  DocumentKey,
  AttachedDocument
>;

type FieldErrors = Partial<Record<keyof SignupForm | DocumentKey, string>>;

const INITIAL_FORM: SignupForm = {
  fullName: '',
  phone: '',
  email: '',
  nin: '',
  address: '',
  state: DEFAULT_STATE,
  vehicleType: 'Motorcycle',
  plateNumber: '',
  licenseId: '',
  guarantorName: '',
  guarantorPhone: '',
  guarantorRelationship: 'Employer',
  guarantorAddress: '',
  guarantorNin: '',
  bankName: 'Access Bank',
  accountNumber: '',
  accountName: '',
  kinName: '',
  kinPhone: '',
  kinRelationship: 'Spouse',
};

function validate(form: SignupForm, documents: Record<DocumentKey, AttachedDocument>): FieldErrors {
  const errors: FieldErrors = {};

  const name = form.fullName.trim();
  if (!name) {
    errors.fullName = 'Full name is required';
  } else if (name.split(/\s+/).length < 2) {
    errors.fullName = 'Enter both your first and last name';
  }

  const phone = form.phone.trim();
  if (!phone) {
    errors.phone = 'Phone number is required';
  } else if (!isValidNigerianPhone(phone)) {
    errors.phone = nigerianPhoneError(phone) ?? 'Enter a valid Nigerian number';
  }

  const email = form.email.trim();
  if (!email) {
    errors.email = 'Email is required';
  } else if (!isValidEmail(email)) {
    errors.email = 'Enter a valid email address';
  }

  // Required. `isValidNin` treats blank as valid — it was written when this
  // field was optional — so emptiness is checked separately, same as the
  // guarantor's NIN below.
  if (!form.nin.trim()) {
    errors.nin = 'NIN is required';
  } else if (!isValidNin(form.nin)) {
    errors.nin = `NIN must be exactly ${NIN_LENGTH} digits`;
  }

  // Same 10-character floor as the guarantor's address: enough to reject "Lagos"
  // or "n/a" without demanding a format Nigerian addresses don't have.
  if (!form.address.trim()) {
    errors.address = 'Address is required';
  } else if (form.address.trim().length < 10) {
    errors.address = 'Enter a full residential or office address';
  }

  const plate = form.plateNumber.trim();
  if (!plate) {
    errors.plateNumber = 'Plate number is required';
  } else if (!isValidPlateNumber(plate)) {
    errors.plateNumber = 'Enter a valid plate, e.g. ABC-123DE';
  }

  const licenseId = form.licenseId.trim();
  if (!licenseId) {
    errors.licenseId = 'Licence ID is required';
  } else if (!isValidLicenceId(licenseId)) {
    errors.licenseId = `Licence ID must be exactly ${LICENCE_LENGTH} letters or numbers`;
  }

  // Guarantor
  if (!form.guarantorName.trim()) {
    errors.guarantorName = "Guarantor's name is required";
  } else if (form.guarantorName.trim().split(/\s+/).length < 2) {
    errors.guarantorName = 'Enter their first and last name';
  }
  if (!form.guarantorPhone.trim()) {
    errors.guarantorPhone = "Guarantor's phone is required";
  } else if (!isValidNigerianPhone(form.guarantorPhone)) {
    errors.guarantorPhone =
      nigerianPhoneError(form.guarantorPhone) ?? 'Enter a valid Nigerian number';
  }
  // Required. `isValidNin` treats blank as valid because the applicant's own
  // NIN is optional, so emptiness has to be checked separately here.
  if (!form.guarantorNin.trim()) {
    errors.guarantorNin = "Guarantor's NIN is required";
  } else if (!isValidNin(form.guarantorNin)) {
    errors.guarantorNin = `NIN must be exactly ${NIN_LENGTH} digits`;
  }

  if (form.guarantorAddress.trim().length < 10) {
    errors.guarantorAddress = 'Enter a full residential or office address';
  }

  // Payout account
  if (!form.accountNumber.trim()) {
    errors.accountNumber = 'Account number is required';
  } else if (!isValidNuban(form.accountNumber)) {
    errors.accountNumber = `NUBAN account numbers are ${NUBAN_LENGTH} digits`;
  }
  if (!form.accountName.trim()) {
    errors.accountName = 'Account name is required';
  }

  // Next of kin
  if (!form.kinName.trim()) {
    errors.kinName = "Next of kin's name is required";
  }
  if (!form.kinPhone.trim()) {
    errors.kinPhone = "Next of kin's phone is required";
  } else if (!isValidNigerianPhone(form.kinPhone)) {
    errors.kinPhone = nigerianPhoneError(form.kinPhone) ?? 'Enter a valid Nigerian number';
  }

  for (const doc of DOCUMENTS) {
    if (!documents[doc.key]) {
      errors[doc.key] = `Attach your ${doc.label.toLowerCase()}`;
    }
  }

  return errors;
}

/** Mock reference, e.g. DRV-4821. Stands in for a server-issued application ID. */
function generateReference(): string {
  return `DRV-${Math.floor(1000 + Math.random() * 9000)}`;
}

export default function DriverSignupScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { registerDriver } = useSession();
  const { requireAuth, isAuthenticated } = useAuthGate();

  const [form, setForm] = useState<SignupForm>(INITIAL_FORM);
  const [documents, setDocuments] = useState<Record<DocumentKey, AttachedDocument>>(NO_DOCUMENTS);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [reference, setReference] = useState('');

  const setField = <K extends keyof SignupForm>(key: K, value: SignupForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  /**
   * Stands in for a file picker: picking produces a filename, which is what the
   * row shows back. Tapping an attached row clears it, so a mistake is
   * recoverable.
   */
  const clearDocumentError = (key: DocumentKey) =>
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });

  const removeDocument = (key: DocumentKey) => {
    setDocuments((prev) => ({ ...prev, [key]: null }));
  };

  /**
   * Opens the OS file browser. Accepts images and PDFs — a licence is usually
   * photographed, an insurance certificate is usually a PDF.
   */
  const pickDocumentFile = async (key: DocumentKey) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'application/pdf'],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled) return;

      const asset = result.assets[0];
      if (!asset) return;
      if (asset.size && asset.size > MAX_DOCUMENT_BYTES) {
        showDialog('File too large', `Attachments must be under ${MAX_DOCUMENT_MB} MB.`);
        return;
      }

      setDocuments((prev) => ({
        ...prev,
        [key]: { fileName: asset.name, uri: asset.uri, size: asset.size ?? null },
      }));
      clearDocumentError(key);
    } catch {
      showDialog('Could not attach', 'Something went wrong opening the file browser.');
    }
  };

  /** Camera capture, for documents the applicant is holding rather than storing. */
  const captureDocument = async (key: DocumentKey) => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        showDialog(
          'Camera access needed',
          'Allow camera access in your settings to photograph this document.',
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.7,
      });
      if (result.canceled) return;

      const asset = result.assets[0];
      if (!asset) return;

      setDocuments((prev) => ({
        ...prev,
        [key]: {
          fileName: asset.fileName ?? `${key}-${new Date().toISOString().slice(0, 10)}.jpg`,
          uri: asset.uri,
          size: asset.fileSize ?? null,
        },
      }));
      clearDocumentError(key);
    } catch {
      showDialog('Could not attach', 'Something went wrong opening the camera.');
    }
  };

  /**
   * Camera isn't offered on web — there's no capture UI to fall back to, and the
   * file browser already covers picking an existing photo.
   */
  const attachDocument = (key: DocumentKey, label: string) => {
    if (Platform.OS === 'web') {
      void pickDocumentFile(key);
      return;
    }

    showDialog(label, 'How would you like to attach this?', [
      { text: 'Take photo', onPress: () => void captureDocument(key) },
      { text: 'Choose file', onPress: () => void pickDocumentFile(key) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  /**
   * Validates one field on blur so mistakes surface as you go, rather than all
   * at once at the end. Runs the same `validate` as submit and keeps only this
   * field's message, so the two can never disagree.
   */
  const validateField = (key: keyof SignupForm) => {
    const all = validate(form, documents);
    setErrors((prev) => {
      const next = { ...prev };
      if (all[key]) next[key] = all[key];
      else delete next[key];
      return next;
    });
  };

  const handleSubmit = () => {
    const nextErrors = validate(form, documents);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    /*
     * Validate first, then ask for an account — the same order as the booking
     * form. Gating on entry would send someone away before they'd seen what
     * driving for LOCI involves, and would throw away everything they'd typed.
     * Here the application is already complete and the state survives the trip
     * to sign-in, because this screen stays mounted underneath.
     */
    requireAuth(submitApplication, {
      title: 'Sign in to submit your application',
      reason:
        'Your application is tied to an account: it is how we tell you the outcome, and how you get into the driver dashboard once approved. Nothing you have typed will be lost.',
      next: '/driver-signup',
    });
  };

  /** Runs only once we know whose application this is. */
  const submitApplication = () => {
    setIsSubmitting(true);
    // Stand-in for a network round trip — no API is called.
    setTimeout(() => {
      const ref = generateReference();

      // The rest of the application is still discarded, but the location has to
      // survive: Find Jobs matches on it. `baseCity` is resolved here, once, so
      // every reader gets the same answer instead of re-deriving it.
      registerDriver({
        state: form.state,
        baseCity: cityForState(form.state),
        address: form.address.trim(),
        reference: ref,
        submittedAt: new Date().toISOString(),
      });

      setReference(ref);
      setIsSubmitting(false);
      setIsSubmitted(true);
    }, 1000);
  };

  /**
   * Clears the form and opens the driver dashboard. `replace`, not `push`, so
   * the back gesture can't return to a submitted application.
   */
  const goToDashboard = () => {
    setForm(INITIAL_FORM);
    setDocuments(NO_DOCUMENTS);
    setErrors({});
    setIsSubmitted(false);
    setReference('');
    router.replace('/driver');
  };

  if (isSubmitted) {
    return <ReviewStatus reference={reference} form={form} onGoToDashboard={goToDashboard} />;
  }

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: PageCanvas }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag">
        <View style={styles.content}>
          {/* Full-width: the persistent nav bar is the way back out. */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.text }]}>Be a Driver</Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              Tell us about yourself and your vehicle. Review usually takes 3–7 working days.
            </Text>
          </View>

          {/*
            Said up front rather than sprung at submit. Someone who knows an
            account is needed can create one before filling in a bank account
            number and a guarantor's NIN.
          */}
          {!isAuthenticated && (
            <View style={[styles.authNotice, { backgroundColor: theme.primarySoft }]}>
              <LogIn color={theme.primaryOnSoft} size={16} />
              <Text style={[styles.authNoticeText, { color: theme.primaryOnSoft }]}>
                You&apos;ll need a LOCI account to submit this application. Fill it in first —
                we&apos;ll ask you to sign in at the end and keep your answers.
              </Text>
            </View>
          )}

          {/* Personal details */}
          <Card style={styles.card}>
            <SectionHeading
              icon={<UserRound color={theme.primary} size={18} />}
              title="Your details"
            />

            <Field
              label="Full name"
              icon={(color, size) => <UserRound color={color} size={size} />}
              placeholder="Chidi Okafor"
              value={form.fullName}
              onChangeText={(text) => setField('fullName', text)}
              onBlur={() => validateField('fullName')}
              error={errors.fullName}
              autoCapitalize="words"
            />

            <ValidatedPhoneInput
              label="Phone number"
              value={form.phone}
              onChangeText={(text) => setField('phone', text)}
              onBlur={() => validateField('phone')}
              showError={Boolean(errors.phone)}
            />

            <ValidatedEmailInput
              label="Email address"
              placeholder="chidi@example.com"
              value={form.email}
              onChangeText={(text) => setField('email', text)}
              onBlur={() => validateField('email')}
              showError={Boolean(errors.email)}
            />

            {/* Required, alongside the Government ID upload. */}
            <Field
              label="National Identification Number (NIN)"
              icon={(color, size) => <IdCard color={color} size={size} />}
              placeholder="12345678901"
              value={form.nin}
              onChangeText={(text) => setField('nin', text.replace(/\D/g, '').slice(0, NIN_LENGTH))}
              onBlur={() => validateField('nin')}
              error={errors.nin}
              hint={`Required — ${NIN_LENGTH} digits`}
              keyboardType="number-pad"
              maxLength={NIN_LENGTH}
            />

            <Field
              label="Residential or office address"
              icon={(color, size) => <MapPin color={color} size={size} />}
              placeholder="14 Awolowo Road, Ikoyi, Lagos"
              value={form.address}
              onChangeText={(text) => setField('address', text)}
              onBlur={() => validateField('address')}
              error={errors.address}
              hint="Where we can reach you, and where your jobs are matched from"
              multiline
            />
          </Card>

          {/* Vehicle and coverage */}
          <Card style={styles.card}>
            <SectionHeading icon={<Truck color={theme.primary} size={18} />} title="Your vehicle" />

            <Dropdown
              label="State of operation"
              options={NIGERIA_STATES}
              searchable
              searchPlaceholder="Search state"
              selected={form.state}
              onSelect={(value) => setField('state', value)}
              icon={(color, size) => <Building2 color={color} size={size} />}
            />

            <View style={styles.pickerField}>
              <View style={styles.pickerLabelRow}>
                <Bike color={theme.textSecondary} size={16} />
                <Text style={[styles.pickerLabel, { color: theme.textSecondary }]}>
                  Vehicle type
                </Text>
              </View>
              <ChipGroup
                options={VEHICLE_TYPES}
                selected={form.vehicleType}
                onSelect={(value) => setField('vehicleType', value)}
              />
            </View>

            <Field
              label="Vehicle plate number"
              icon={(color, size) => <Hash color={color} size={size} />}
              placeholder="ABC-123DE"
              value={form.plateNumber}
              onChangeText={(text) => setField('plateNumber', text.toUpperCase())}
              onBlur={() => validateField('plateNumber')}
              error={errors.plateNumber}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={12}
            />

            <Field
              label="Driver licence ID"
              icon={(color, size) => <IdCard color={color} size={size} />}
              placeholder="ABC123456789"
              value={form.licenseId}
              onChangeText={(text) => setField('licenseId', text)}
              onBlur={() => validateField('licenseId')}
              error={errors.licenseId}
              hint={`${LICENCE_LENGTH} letters or numbers`}
              maxLength={LICENCE_LENGTH}
              autoCapitalize="characters"
              autoCorrect={false}
            />
          </Card>

          {/* Guarantor */}
          <Card style={styles.card}>
            <SectionHeading
              icon={<UserCheck color={theme.primary} size={18} />}
              title="Guarantor information"
            />
            <Text style={[styles.helper, { color: theme.textMuted }]}>
              Someone who can vouch for you. We contact them only if we need to verify your
              application.
            </Text>

            <Field
              label="Guarantor's full name"
              icon={(color, size) => <UserRound color={color} size={size} />}
              placeholder="Ngozi Eze"
              value={form.guarantorName}
              onChangeText={(text) => setField('guarantorName', text)}
              onBlur={() => validateField('guarantorName')}
              error={errors.guarantorName}
              autoCapitalize="words"
            />

            <ValidatedPhoneInput
              label="Guarantor's phone number"
              value={form.guarantorPhone}
              onChangeText={(text) => setField('guarantorPhone', text)}
              onBlur={() => validateField('guarantorPhone')}
              showError={Boolean(errors.guarantorPhone)}
            />

            <Dropdown
              label="Relationship"
              options={GUARANTOR_RELATIONSHIPS}
              selected={form.guarantorRelationship}
              onSelect={(value) => setField('guarantorRelationship', value)}
              icon={(color, size) => <UserCheck color={color} size={size} />}
            />

            <Field
              label="Residential or office address"
              icon={(color, size) => <MapPin color={color} size={size} />}
              placeholder="14 Awolowo Road, Ikoyi, Lagos"
              value={form.guarantorAddress}
              onChangeText={(text) => setField('guarantorAddress', text)}
              onBlur={() => validateField('guarantorAddress')}
              error={errors.guarantorAddress}
              multiline
            />

            {/*
              Required, unlike the applicant's own NIN above — a guarantor is
              only worth having if they can actually be identified.
            */}
            <Field
              label="Guarantor's NIN"
              icon={(color, size) => <IdCard color={color} size={size} />}
              placeholder="12345678901"
              value={form.guarantorNin}
              onChangeText={(text) =>
                setField('guarantorNin', text.replace(/\D/g, '').slice(0, NIN_LENGTH))
              }
              onBlur={() => validateField('guarantorNin')}
              error={errors.guarantorNin}
              hint={`Required — ${NIN_LENGTH} digits. Adds an extra layer of trust and security.`}
              keyboardType="number-pad"
              maxLength={NIN_LENGTH}
            />
          </Card>

          {/* Payout account */}
          <Card style={styles.card}>
            <SectionHeading
              icon={<Banknote color={theme.primary} size={18} />}
              title="Payout account details"
            />
            <Text style={[styles.helper, { color: theme.textMuted }]}>
              Where your delivery earnings are paid. The account must be in your own name.
            </Text>

            <Dropdown
              label="Bank name"
              options={NIGERIAN_BANKS}
              searchable
              searchPlaceholder="Search bank"
              selected={form.bankName}
              onSelect={(value) => setField('bankName', value)}
              icon={(color, size) => <Landmark color={color} size={size} />}
            />

            <Field
              label="Account number"
              icon={(color, size) => <Hash color={color} size={size} />}
              placeholder="0123456789"
              value={form.accountNumber}
              onChangeText={(text) =>
                setField('accountNumber', text.replace(/\D/g, '').slice(0, NUBAN_LENGTH))
              }
              onBlur={() => validateField('accountNumber')}
              error={errors.accountNumber}
              hint={`${NUBAN_LENGTH}-digit NUBAN`}
              keyboardType="number-pad"
              maxLength={NUBAN_LENGTH}
            />

            <Field
              label="Account name"
              icon={(color, size) => <UserRound color={color} size={size} />}
              placeholder="As it appears on your bank statement"
              value={form.accountName}
              onChangeText={(text) => setField('accountName', text)}
              onBlur={() => validateField('accountName')}
              error={errors.accountName}
              /*
                Typed by hand for now. A real build resolves this from the bank
                and account number via a name-enquiry call, then locks the field.
              */
              hint="Typed for now — will be verified against your bank"
              autoCapitalize="words"
            />
          </Card>

          {/* Next of kin */}
          <Card style={styles.card}>
            <SectionHeading
              icon={<HeartPulse color={theme.primary} size={18} />}
              title="Emergency contact (next of kin)"
            />
            <Text style={[styles.helper, { color: theme.textMuted }]}>
              Who we call if something happens while you are on a delivery.
            </Text>

            <Field
              label="Next of kin's name"
              icon={(color, size) => <UserRound color={color} size={size} />}
              placeholder="Emeka Nwosu"
              value={form.kinName}
              onChangeText={(text) => setField('kinName', text)}
              onBlur={() => validateField('kinName')}
              error={errors.kinName}
              autoCapitalize="words"
            />

            <ValidatedPhoneInput
              label="Next of kin's phone number"
              value={form.kinPhone}
              onChangeText={(text) => setField('kinPhone', text)}
              onBlur={() => validateField('kinPhone')}
              showError={Boolean(errors.kinPhone)}
            />

            <Dropdown
              label="Relationship"
              options={NEXT_OF_KIN_RELATIONSHIPS}
              selected={form.kinRelationship}
              onSelect={(value) => setField('kinRelationship', value)}
              icon={(color, size) => <HeartPulse color={color} size={size} />}
            />
          </Card>

          {/* Documents */}
          <Card style={styles.card}>
            <SectionHeading
              icon={<FileCheck2 color={theme.primary} size={18} />}
              title="Documents"
            />
            <Text style={[styles.helper, { color: theme.textMuted }]}>
              Attachment is simulated for now — tapping marks the document as received.
            </Text>

            {DOCUMENTS.map((doc) => (
              <DocumentRow
                key={doc.key}
                label={doc.label}
                hint={doc.hint}
                document={documents[doc.key]}
                error={errors[doc.key]}
                onAttach={() => attachDocument(doc.key, doc.label)}
                onRemove={() => removeDocument(doc.key)}
              />
            ))}
          </Card>

          <Button
            label={isSubmitting ? 'Submitting…' : 'Submit Application'}
            icon={(color, size) =>
              isSubmitting ? (
                <ActivityIndicator color={color} size="small" />
              ) : (
                <ClipboardCheck color={color} size={size} />
              )
            }
            onPress={handleSubmit}
            // Also blocked while the email is malformed.
            disabled={isSubmitting || !isValidEmail(form.email)}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** "2.4 MB" / "812 KB" — so an applicant can see the scan actually attached. */
function formatSize(bytes: number | null): string | null {
  if (bytes === null || bytes <= 0) return null;
  return bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.round(bytes / 1024)} KB`;
}

function DocumentRow({
  label,
  hint,
  document,
  error,
  onAttach,
  onRemove,
}: {
  label: string;
  hint: string;
  document: AttachedDocument;
  error?: string;
  onAttach: () => void;
  onRemove: () => void;
}) {
  const theme = useTheme();
  const attached = document !== null;
  const size = attached ? formatSize(document.size) : null;

  return (
    <View style={styles.docBlock}>
      <Pressable
        onPress={attached ? onRemove : onAttach}
        accessibilityRole="button"
        accessibilityState={{ checked: attached }}
        accessibilityLabel={
          attached
            ? `${label}. Attached: ${document.fileName}. Tap to remove.`
            : `${label}. ${hint}. Tap to attach a photo or file.`
        }
        style={({ pressed }) => [
          styles.docRow,
          {
            backgroundColor: attached ? theme.successSoft : theme.surfaceMuted,
            borderColor: error ? theme.danger : attached ? theme.success : 'transparent',
          },
          pressed && styles.pressed,
        ]}>
        <View
          style={[
            styles.docIcon,
            { backgroundColor: attached ? theme.success : theme.backgroundSelected },
          ]}>
          {attached ? (
            <CheckCircle2 color={theme.successSoft} size={18} />
          ) : (
            <Upload color={theme.textSecondary} size={18} />
          )}
        </View>

        <View style={styles.docText}>
          <Text style={[styles.docLabel, { color: attached ? theme.successOnSoft : theme.text }]}>
            {label}
          </Text>
          {attached ? (
            <View style={styles.docFileRow}>
              <CheckCircle2 color={theme.success} size={13} />
              <Text style={[styles.docFileName, { color: theme.successOnSoft }]} numberOfLines={1}>
                {size ? `${document.fileName} · ${size}` : document.fileName}
              </Text>
            </View>
          ) : (
            <Text style={[styles.docHint, { color: theme.textMuted }]}>{hint}</Text>
          )}
        </View>

        <Text style={[styles.docAction, { color: attached ? theme.successOnSoft : theme.primary }]}>
          {attached ? 'Remove' : 'Upload'}
        </Text>
      </Pressable>
      {!!error && <Text style={[styles.errorText, { color: theme.danger }]}>{error}</Text>}
    </View>
  );
}

/** What the applicant should do while the review runs. */
const NEXT_STEPS: { text: string; icon: (color: string) => React.ReactNode }[] = [
  { text: 'Check your inbox for a confirmation email.', icon: (c) => <Mail color={c} size={15} /> },
  {
    text: 'Stay available for a potential verification call.',
    icon: (c) => <PhoneCall color={c} size={15} />,
  },
  {
    text: 'Ensure your vehicle is ready for final inspection.',
    icon: (c) => <ClipboardCheck color={c} size={15} />,
  },
];

function ReviewStatus({
  reference,
  form,
  onGoToDashboard,
}: {
  reference: string;
  form: SignupForm;
  onGoToDashboard: () => void;
}) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const VehicleIcon = VEHICLE_ICONS[form.vehicleType];
  const firstName = form.fullName.trim().split(/\s+/)[0];
  // Four labels across need roughly 140px each before they start truncating.
  const wideTracker = width >= 620;

  /**
   * Four stages, one of which is current. `done` and `active` are derived from
   * position rather than stored per step, so the tracker can never show two
   * current stages or a completed step after a pending one.
   */
  const CURRENT_STEP = 1;
  const steps = useMemo(
    () =>
      ['Application Received', 'Document Review', 'Background Check', 'Approval & Activation'].map(
        (label, index) => ({
          key: label,
          label,
          done: index < CURRENT_STEP,
          active: index === CURRENT_STEP,
        }),
      ),
    [],
  );

  return (
    <ScrollView style={{ backgroundColor: PageCanvas }} contentContainerStyle={styles.container}>
      <View style={styles.content}>
        {/* ---------- Success header ---------- */}
        <View style={styles.statusHero}>
          <View style={[styles.statusIcon, { backgroundColor: theme.successSoft }]}>
            <CircleCheckBig color={theme.success} size={34} />
          </View>

          <Text style={[styles.statusTitle, { color: theme.text }]}>
            Application Submitted Successfully!
          </Text>
          <Text style={[styles.statusBody, { color: theme.textSecondary }]}>
            Thank you for joining the LOCI network, {firstName}. Your application has been received.
          </Text>

          {/* Application ID, in a pill of its own so it can be read back over the phone. */}
          <View style={[styles.refPill, { backgroundColor: theme.primarySoft }]}>
            <Hash color={theme.primaryOnSoft} size={13} />
            <Text
              style={[styles.refPillText, { color: theme.primaryOnSoft }]}
              accessibilityLabel={`Application I D ${reference.split('').join(' ')}`}>
              #{reference}
            </Text>
          </View>
        </View>

        <Card style={styles.card}>
          <View style={styles.refRow}>
            <Text style={[styles.refLabel, { color: theme.textMuted }]}>Reference</Text>
            <Text style={[styles.refValue, { color: theme.primary }]}>#{reference}</Text>
          </View>

          <View style={[styles.divider, { backgroundColor: theme.border }]} />

          <SummaryRow
            icon={<UserRound color={theme.textMuted} size={15} />}
            label="Applicant"
            value={form.fullName.trim()}
          />
          <SummaryRow
            icon={<Mail color={theme.textMuted} size={15} />}
            label="Email"
            value={form.email.trim()}
          />
          <SummaryRow
            icon={<Building2 color={theme.textMuted} size={15} />}
            label="State"
            value={form.state}
          />
          <SummaryRow
            icon={<Landmark color={theme.textMuted} size={15} />}
            label="Payout"
            value={`${form.bankName} · ${form.accountNumber.trim()}`}
          />
          <SummaryRow
            icon={<UserCheck color={theme.textMuted} size={15} />}
            label="Guarantor"
            value={`${form.guarantorName.trim()} (${form.guarantorRelationship})`}
          />
          <SummaryRow
            icon={<HeartPulse color={theme.textMuted} size={15} />}
            label="Next of kin"
            value={`${form.kinName.trim()} (${form.kinRelationship})`}
          />
          <SummaryRow
            icon={<Hash color={theme.textMuted} size={15} />}
            label="Plate"
            value={form.plateNumber.trim()}
          />
          <SummaryRow
            icon={<VehicleIcon color={theme.textMuted} size={15} />}
            label="Vehicle"
            value={form.vehicleType}
          />
          <SummaryRow
            icon={<IdCard color={theme.textMuted} size={15} />}
            label="Licence ID"
            value={form.licenseId.trim()}
          />
        </Card>

        {/* ---------- Status tracker ---------- */}
        <Card style={styles.card}>
          <SectionLabel>Application status</SectionLabel>

          {/*
            Horizontal on a wide screen, vertical on a phone. Four labels will
            not fit across 360px without truncating to the point of uselessness.
          */}
          <View style={[styles.tracker, wideTracker && styles.trackerRow]}>
            {steps.map((step, index) => {
              const tone = step.done
                ? theme.success
                : step.active
                  ? theme.warning
                  : theme.textMuted;
              const isLast = index === steps.length - 1;

              return (
                <View
                  key={step.key}
                  style={[styles.trackerStep, wideTracker && styles.trackerStepRow]}
                  accessibilityLabel={`Step ${index + 1} of ${steps.length}. ${step.label}. ${
                    step.done ? 'Completed' : step.active ? 'In progress' : 'Pending'
                  }`}>
                  <View style={[styles.trackerMarkRow, wideTracker && styles.trackerMarkRowWide]}>
                    {/* Glyph, not just a coloured dot — colour alone can't say "done" vs "waiting". */}
                    <View
                      style={[
                        styles.trackerDot,
                        { borderColor: tone, backgroundColor: step.done ? tone : theme.surface },
                      ]}>
                      {step.done ? (
                        <Check color={theme.surface} size={13} />
                      ) : step.active ? (
                        <Clock color={tone} size={13} />
                      ) : (
                        <View style={[styles.trackerPending, { backgroundColor: tone }]} />
                      )}
                    </View>

                    {!isLast && (
                      <View
                        style={[
                          wideTracker ? styles.trackerBarWide : styles.trackerBar,
                          { backgroundColor: step.done ? theme.success : theme.border },
                        ]}
                      />
                    )}
                  </View>

                  <Text
                    style={[
                      styles.trackerLabel,
                      wideTracker && styles.trackerLabelWide,
                      { color: step.active ? theme.text : theme.textSecondary },
                      step.active && styles.stepTextActive,
                    ]}
                    numberOfLines={2}>
                    {step.label}
                  </Text>
                </View>
              );
            })}
          </View>
        </Card>

        {/* ---------- Current status callout ---------- */}
        <View
          style={[
            styles.callout,
            { backgroundColor: theme.warningSoft, borderLeftColor: theme.warningOnSoft },
          ]}>
          <Clock color={theme.warningOnSoft} size={18} />
          <View style={styles.calloutText}>
            <Text style={[styles.calloutTitle, { color: theme.warningOnSoft }]}>
              Current Status: In Review
            </Text>
            <Text style={[styles.calloutBody, { color: theme.warningOnSoft }]}>
              Our compliance team is verifying your documents. This typically takes 3–7 working
              days. We&apos;ll notify you via SMS and email when it&apos;s complete.
            </Text>
          </View>
        </View>

        {/* ---------- Next steps ---------- */}
        <Card style={styles.card}>
          <SectionLabel>What happens next</SectionLabel>
          {NEXT_STEPS.map((item) => (
            <View key={item.text} style={styles.stepRow}>
              <View style={[styles.nextIcon, { backgroundColor: theme.primarySoft }]}>
                {item.icon(theme.primaryOnSoft)}
              </View>
              <Text style={[styles.stepText, { color: theme.textSecondary }]}>{item.text}</Text>
            </View>
          ))}
        </Card>

        <Button
          label="Go to Driver Dashboard"
          icon={(color, size) => <LayoutDashboard color={color} size={size} />}
          onPress={onGoToDashboard}
        />
      </View>
    </ScrollView>
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

function SummaryRow({
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
    <View style={styles.summaryRow}>
      <View style={styles.summaryLabel}>
        {icon}
        <Text style={[styles.summaryLabelText, { color: theme.textMuted }]}>{label}</Text>
      </View>
      <Text style={[styles.summaryValue, { color: theme.text }]} numberOfLines={1}>
        {value}
      </Text>
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
    padding: Spacing.four,
    paddingTop: Spacing.five,
    paddingBottom: Spacing.six,
  },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    gap: Spacing.three,
  },
  authNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
    padding: Spacing.three - 4,
    borderRadius: Radius.md,
    marginBottom: Spacing.three,
  },
  authNoticeText: {
    ...Typography.meta,
    flex: 1,
    lineHeight: 19,
  },
  header: {
    gap: Spacing.two - 2,
  },
  title: {
    ...Typography.screenTitle,
    fontSize: 26,
  },
  subtitle: {
    ...Typography.screenSubtitle,
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
  helper: {
    ...Typography.meta,
  },
  errorText: {
    ...Typography.meta,
  },
  pressed: {
    opacity: 0.75,
  },

  // Documents
  docBlock: {
    gap: Spacing.one,
  },
  docRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three - 2,
    padding: Spacing.three - 4,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  docIcon: {
    width: 38,
    height: 38,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  docText: {
    flex: 1,
    gap: Spacing.half,
  },
  docLabel: {
    ...Typography.body,
    ...font(700),
  },
  docFileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one + 2,
  },
  docFileName: {
    flex: 1,
    ...Typography.caption,
    ...font(600),
  },
  docHint: {
    ...Typography.meta,
  },
  docAction: {
    ...Typography.caption,
    ...font(700),
  },

  // Review status
  statusHero: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.four,
  },
  refPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one + 2,
    paddingVertical: Spacing.one + 2,
    paddingHorizontal: Spacing.three - 4,
    borderRadius: Radius.pill,
  },
  refPillText: {
    fontSize: 15,
    ...font(700),
    letterSpacing: 0.4,
  },
  /** Vertical by default; `trackerRow` turns it horizontal when there's room. */
  tracker: {
    gap: Spacing.three - 4,
  },
  trackerRow: {
    flexDirection: 'row',
    gap: 0,
  },
  trackerStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three - 4,
  },
  trackerStepRow: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  trackerMarkRow: {
    alignItems: 'center',
  },
  trackerMarkRowWide: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  trackerDot: {
    width: 26,
    height: 26,
    borderRadius: Radius.pill,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackerPending: {
    width: 7,
    height: 7,
    borderRadius: Radius.pill,
  },
  /** Connector between nodes: down the left when stacked, across when wide. */
  trackerBar: {
    width: 2,
    height: 18,
    marginTop: 2,
  },
  trackerBarWide: {
    flex: 1,
    height: 2,
    marginHorizontal: Spacing.two - 2,
  },
  trackerLabel: {
    flex: 1,
    ...Typography.body,
  },
  trackerLabelWide: {
    flex: 0,
    paddingRight: Spacing.three,
  },
  callout: {
    flexDirection: 'row',
    gap: Spacing.three - 4,
    padding: Spacing.three,
    borderRadius: Radius.md,
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
    borderLeftWidth: 3,
    marginBottom: Spacing.three,
  },
  calloutText: {
    flex: 1,
    gap: Spacing.one,
  },
  calloutTitle: {
    ...Typography.body,
    ...font(700),
  },
  calloutBody: {
    ...Typography.caption,
    lineHeight: 20,
  },
  nextIcon: {
    width: 28,
    height: 28,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusIcon: {
    width: 66,
    height: 66,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.one,
  },
  statusTitle: {
    ...Typography.screenTitle,
    fontSize: 26,
    textAlign: 'center',
  },
  statusBody: {
    ...Typography.body,
    textAlign: 'center',
    lineHeight: 22,
  },
  refRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  refLabel: {
    ...Typography.caption,
  },
  refValue: {
    fontSize: 18,
    ...font(800),
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  summaryLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one + 2,
  },
  summaryLabelText: {
    ...Typography.meta,
  },
  summaryValue: {
    ...Typography.meta,
    ...font(700),
    flexShrink: 1,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two + 2,
  },
  stepText: {
    ...Typography.body,
  },
  stepTextActive: {
    ...font(700),
  },
});
