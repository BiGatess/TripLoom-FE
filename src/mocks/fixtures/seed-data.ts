import type {
  AuditLogEntry,
  Booking,
  Category,
  ChatConversation,
  Destination,
  Itinerary,
  OtpPurpose,
  PaymentRecord,
  Review,
  SePayEvent,
  StaffMember,
  TravelService,
  TripDraftRequest,
  UserProfile,
} from '@/api/contracts';
import { STITCH_IMAGES } from '@/shared/utils/media';

export interface MockUserAccount {
  profile: UserProfile;
  password: string;
  authVersion: number;
}

export interface MockOtpCodeRecord {
  id: string;
  email: string;
  purpose: OtpPurpose;
  code: string;
  createdAt: string;
  expiresAt: string;
  used: boolean;
  invalidated: boolean;
  failedAttempts: number;
  pendingPayload?: {
    fullName?: string;
    password?: string;
  };
}

export interface MockOtpRateBucket {
  email: string;
  sendsInBurst: number;
  lastSentAt: string | null;
  burstLockedUntil: string | null;
}

export interface MockDevFlags {
  simulateAiFailure: boolean;
  simulateNetworkFailure: boolean;
  simulateEmailFailure: boolean;
}

export interface MockDatabase {
  schemaVersion: number;
  currentUserId: string | null;
  currentAuthVersion: number | null;
  accounts: MockUserAccount[];
  categories: Category[];
  destinations: Destination[];
  services: TravelService[];
  reviews: Review[];
  favoritesByUser: Record<string, string[]>;
  tripDraftRequests: TripDraftRequest[];
  itineraries: Itinerary[];
  conversations: ChatConversation[];
  bookings: Booking[];
  payments: PaymentRecord[];
  paymentEvents: SePayEvent[];
  bookingIdempotencyMap: Record<string, string>;
  staffMembers: StaffMember[];
  auditLogs: AuditLogEntry[];
  otpCodes: MockOtpCodeRecord[];
  otpRateBuckets: Record<string, MockOtpRateBucket>;
  devFlags: MockDevFlags;
  counters: {
    booking: number;
    paymentCode: number;
    event: number;
    itinerary: number;
    draft: number;
    review: number;
    conversation: number;
    audit: number;
    category: number;
    destination: number;
    service: number;
  };
}

export const MOCK_SCHEMA_VERSION = 2;

export function createSeedDatabase(nowMs = Date.now()): MockDatabase {
  const iso = (offsetMs = 0) => new Date(nowMs + offsetMs).toISOString();
  // BK001 mặc định còn 09:42 (582 giây) so với thời điểm khởi tạo (t0 = now - 5m18s, expires = now + 9m42s)
  const bk001CreatedAt = iso(-(15 * 60 - 582) * 1000);
  const bk001ExpiresAt = iso(582 * 1000);
  const draftExpiresAt = iso(24 * 60 * 60 * 1000);

  const accounts: MockUserAccount[] = [
    {
      password: 'TripLoom@123',
      authVersion: 1,
      profile: {
        id: 'USR001',
        email: 'minh.anh@example.com',
        fullName: 'Nguyễn Minh Anh',
        displayName: 'Minh Anh',
        avatarUrl: STITCH_IMAGES.avatarMinhAnh,
        phone: '0905 123 456',
        role: 'MEMBER',
        permissions: [],
        preferences: {
          categoryIds: ['CAT01', 'CAT03'],
          defaultBudgetVnd: 3000000,
          defaultPartySize: 2,
          pace: 'MODERATE',
        },
        updatedAt: '2027-01-10T08:00:00+07:00',
      },
    },
    {
      password: 'Admin@123',
      authVersion: 1,
      profile: {
        id: 'ADM001',
        email: 'admin@triploom.vn',
        fullName: 'Quản trị viên hệ thống',
        displayName: 'Quản trị viên',
        avatarUrl: null,
        phone: '0901 000 001',
        role: 'ADMIN',
        staffCode: 'ADM001',
        staffStatus: 'ACTIVE',
        permissions: [
          'STAFF_DESTINATION',
          'STAFF_SERVICE',
          'STAFF_BOOKING',
          'STAFF_REVIEW',
          'STAFF_PAYMENT_VIEW',
        ],
        preferences: {
          categoryIds: ['CAT01'],
          defaultBudgetVnd: 3000000,
          defaultPartySize: 2,
          pace: 'MODERATE',
        },
        updatedAt: '2027-01-01T08:00:00+07:00',
      },
    },
    {
      password: 'Staff@123',
      authVersion: 1,
      profile: {
        id: 'STF_NV001',
        email: 'ha.tran@triploom.vn',
        fullName: 'Trần Thu Hà',
        displayName: 'Thu Hà',
        avatarUrl: null,
        phone: '0912 222 333',
        role: 'STAFF',
        staffCode: 'NV001',
        staffStatus: 'ACTIVE',
        permissions: ['STAFF_DESTINATION', 'STAFF_REVIEW'],
        preferences: {
          categoryIds: ['CAT01'],
          defaultBudgetVnd: 2000000,
          defaultPartySize: 2,
          pace: 'MODERATE',
        },
        updatedAt: '2027-01-12T09:00:00+07:00',
      },
    },
    {
      password: '',
      authVersion: 1,
      profile: {
        id: 'STF_NV002',
        email: 'bao.le@triploom.vn',
        fullName: 'Lê Quốc Bảo',
        displayName: 'Quốc Bảo',
        avatarUrl: null,
        phone: '0914 333 444',
        role: 'STAFF',
        staffCode: 'NV002',
        staffStatus: 'INVITED',
        permissions: ['STAFF_BOOKING'],
        preferences: {
          categoryIds: [],
          defaultBudgetVnd: null,
          defaultPartySize: 2,
          pace: 'MODERATE',
        },
        updatedAt: '2027-01-15T08:30:00+07:00',
      },
    },
    {
      password: 'Staff@123',
      authVersion: 2,
      profile: {
        id: 'STF_NV003',
        email: 'huy.pham@triploom.vn',
        fullName: 'Phạm Quang Huy',
        displayName: 'Quang Huy',
        avatarUrl: null,
        phone: '0918 555 666',
        role: 'STAFF',
        staffCode: 'NV003',
        staffStatus: 'LOCKED',
        permissions: ['STAFF_PAYMENT_VIEW'],
        preferences: {
          categoryIds: [],
          defaultBudgetVnd: null,
          defaultPartySize: 2,
          pace: 'MODERATE',
        },
        updatedAt: '2027-01-14T16:00:00+07:00',
      },
    },
    {
      password: 'Staff@123',
      authVersion: 1,
      profile: {
        id: 'STF_NV004',
        email: 'yen.do@triploom.vn',
        fullName: 'Đỗ Hải Yến',
        displayName: 'Hải Yến',
        avatarUrl: null,
        phone: '0919 777 888',
        role: 'STAFF',
        staffCode: 'NV004',
        staffStatus: 'ACTIVE',
        permissions: ['STAFF_PAYMENT_VIEW'],
        preferences: {
          categoryIds: [],
          defaultBudgetVnd: null,
          defaultPartySize: 2,
          pace: 'MODERATE',
        },
        updatedAt: '2027-01-14T10:00:00+07:00',
      },
    },
  ];

  const categories: Category[] = [
    {
      id: 'CAT01',
      slug: 'van-hoa',
      name: 'Phố cổ & Văn hóa',
      description: 'Di sản kiến trúc, bảo tàng, phố cổ và không gian lịch sử đặc trưng miền Trung.',
      status: 'ACTIVE',
      destinationCount: 2,
      updatedAt: '2027-01-05T09:00:00+07:00',
    },
    {
      id: 'CAT02',
      slug: 'bien',
      name: 'Biển & Nghỉ dưỡng',
      description: 'Bãi biển trong xanh, không gian dạo bộ ven biển và hoạt động dưới nước.',
      status: 'ACTIVE',
      destinationCount: 1,
      updatedAt: '2027-01-05T09:00:00+07:00',
    },
    {
      id: 'CAT03',
      slug: 'thien-nhien',
      name: 'Thiên nhiên',
      description: 'Danh thắng núi non, bán đảo sinh thái và điểm ngắm toàn cảnh.',
      status: 'ACTIVE',
      destinationCount: 2,
      updatedAt: '2027-01-05T09:00:00+07:00',
    },
    {
      id: 'CAT04',
      slug: 'lang-nghe-am-thuc',
      name: 'Làng nghề & Ẩm thực',
      description: 'Làng nghề truyền thống thủ công và không gian ẩm thực địa phương.',
      status: 'ACTIVE',
      destinationCount: 2,
      updatedAt: '2027-01-05T09:00:00+07:00',
    },
  ];

  const destinations: Destination[] = [
    {
      id: 'HA001',
      name: 'Phố cổ Hội An',
      region: 'Hội An',
      categoryId: 'CAT01',
      categoryName: 'Phố cổ & Văn hóa',
      address: 'Phường Minh An, TP. Hội An, Quảng Nam',
      description:
        'Di sản văn hóa thế giới nổi bật với kiến trúc nhà cổ mái ngói rêu phong, Chùa Cầu lịch sử và không gian đèn lồng lung linh bên sông Hoài mỗi buổi tối.',
      imageUrl: STITCH_IMAGES.HA001,
      estimatedCostVnd: 150000,
      openingHours: '07:00 – 21:30 hằng ngày',
      status: 'ACTIVE',
      effectivelyPublic: true,
      averageRating: 5,
      publishedReviewCount: 1,
      version: 1,
      updatedAt: '2027-01-10T10:00:00+07:00',
    },
    {
      id: 'DN001',
      name: 'Biển Mỹ Khê',
      region: 'Đà Nẵng',
      categoryId: 'CAT02',
      categoryName: 'Biển & Nghỉ dưỡng',
      address: 'Đường Võ Nguyên Giáp, Quận Sơn Trà, TP. Đà Nẵng',
      description:
        'Bãi biển cát trắng mịn, sóng êm và không khí trong lành, lý tưởng cho tắm biển sáng sớm, dạo bộ hoàng hôn và trải nghiệm thể thao biển nhẹ nhàng.',
      imageUrl: STITCH_IMAGES.DN001,
      estimatedCostVnd: 0,
      openingHours: 'Mở cửa tự do cả ngày (cứu hộ 05:00 – 19:00)',
      status: 'ACTIVE',
      effectivelyPublic: true,
      averageRating: null,
      publishedReviewCount: 0,
      version: 1,
      updatedAt: '2027-01-10T10:00:00+07:00',
    },
    {
      id: 'DN002',
      name: 'Danh thắng Ngũ Hành Sơn',
      region: 'Đà Nẵng',
      categoryId: 'CAT03',
      categoryName: 'Thiên nhiên',
      address: '81 Huyền Trân Công Chúa, Quận Ngũ Hành Sơn, TP. Đà Nẵng',
      description:
        'Quần thể năm ngọn núi đá vôi gắn với hệ thống hang động tự nhiên, chùa cổ Linh Ứng và tầm nhìn bao quát bờ biển Đà Nẵng.',
      imageUrl: STITCH_IMAGES.DN002,
      estimatedCostVnd: 40000,
      openingHours: '07:00 – 17:30 hằng ngày',
      status: 'ACTIVE',
      effectivelyPublic: true,
      averageRating: 5,
      publishedReviewCount: 1,
      version: 1,
      updatedAt: '2027-01-10T10:00:00+07:00',
    },
    {
      id: 'DN003',
      name: 'Bán đảo Sơn Trà',
      region: 'Đà Nẵng',
      categoryId: 'CAT03',
      categoryName: 'Thiên nhiên',
      address: 'Phường Thọ Quang, Quận Sơn Trà, TP. Đà Nẵng',
      description:
        'Lá phổi xanh của Đà Nẵng với cung đường ven biển tuyệt đẹp, chùa Linh Ứng Bãi Bụt và điểm ngắm cảnh Đỉnh Bàn Cờ.',
      imageUrl: STITCH_IMAGES.DN003,
      estimatedCostVnd: 0,
      openingHours: '07:30 – 17:30 hằng ngày',
      status: 'ACTIVE',
      effectivelyPublic: true,
      averageRating: null,
      publishedReviewCount: 0,
      version: 1,
      updatedAt: '2027-01-10T10:00:00+07:00',
    },
    {
      id: 'HA002',
      name: 'Làng gốm Thanh Hà',
      region: 'Hội An',
      categoryId: 'CAT04',
      categoryName: 'Làng nghề & Ẩm thực',
      address: 'Phạm Phán, Phường Thanh Hà, TP. Hội An, Quảng Nam',
      description:
        'Làng nghề gốm thủ công hơn 500 năm tuổi bên dòng sông Thu Bồn, nơi du khách tận tay xoay bàn gốm và tham quan Công viên Đất Nung.',
      imageUrl: STITCH_IMAGES.HA002,
      estimatedCostVnd: 35000,
      openingHours: '08:00 – 17:30 hằng ngày',
      status: 'ACTIVE',
      effectivelyPublic: true,
      averageRating: null,
      publishedReviewCount: 0,
      version: 1,
      updatedAt: '2027-01-10T10:00:00+07:00',
    },
    {
      id: 'DN004',
      name: 'Bảo tàng Điêu khắc Chăm',
      region: 'Đà Nẵng',
      categoryId: 'CAT01',
      categoryName: 'Phố cổ & Văn hóa',
      address: 'Số 02 Đường 2 Tháng 9, Quận Hải Châu, TP. Đà Nẵng',
      description:
        'Bảo tàng trưng bày bộ sưu tập hiện vật điêu khắc Chăm Pa lớn nhất cả nước với kiến trúc giao thoa Đông – Tây thanh lịch.',
      imageUrl: STITCH_IMAGES.DN004,
      estimatedCostVnd: 60000,
      openingHours: '07:00 – 17:00 hằng ngày',
      status: 'ACTIVE',
      effectivelyPublic: true,
      averageRating: null,
      publishedReviewCount: 0,
      version: 1,
      updatedAt: '2027-01-10T10:00:00+07:00',
    },
    {
      id: 'DN005',
      name: 'Chợ Cồn Đà Nẵng',
      region: 'Đà Nẵng',
      categoryId: 'CAT04',
      categoryName: 'Làng nghề & Ẩm thực',
      address: '290 Hùng Vương, Quận Hải Châu, TP. Đà Nẵng',
      description:
        'Khu chợ truyền thống sầm uất bậc nhất Đà Nẵng, nổi tiếng với khu ẩm thực đặc sản địa phương đa dạng (chi phí tùy món thực tế).',
      imageUrl: STITCH_IMAGES.heroVietnam,
      estimatedCostVnd: null,
      openingHours: '06:00 – 19:00 hằng ngày',
      status: 'ACTIVE',
      effectivelyPublic: true,
      averageRating: null,
      publishedReviewCount: 0,
      version: 1,
      updatedAt: '2027-01-10T10:00:00+07:00',
    },
  ];

  const services: TravelService[] = [
    {
      id: 'SV001',
      destinationId: 'HA001',
      destinationName: 'Phố cổ Hội An',
      name: 'Trải nghiệm làm đèn lồng tại Hội An',
      serviceType: 'Workshop trải nghiệm',
      description:
        'Tự tay chọn khung tre, bọc vải lụa và hoàn thiện chiếc đèn lồng Hội An truyền thống cùng nghệ nhân địa phương trong 90 phút.',
      imageUrl: STITCH_IMAGES.SV001,
      pricePerGuestVnd: 150000,
      maxDailyCapacity: 20,
      status: 'ACTIVE',
      effectivelyBookable: true,
      version: 1,
      updatedAt: '2027-01-10T10:00:00+07:00',
    },
    {
      id: 'SV002',
      destinationId: 'DN001',
      destinationName: 'Biển Mỹ Khê',
      name: 'Chèo SUP đón bình minh Biển Mỹ Khê',
      serviceType: 'Hoạt động ngoài trời',
      description:
        'Hướng dẫn viên đồng hành chèo ván đứng ngắm mặt trời mọc trên biển Mỹ Khê, đã bao gồm áo phao và dụng cụ cơ bản.',
      imageUrl: STITCH_IMAGES.DN001,
      pricePerGuestVnd: 250000,
      maxDailyCapacity: 12,
      status: 'ACTIVE',
      effectivelyBookable: true,
      version: 1,
      updatedAt: '2027-01-10T10:00:00+07:00',
    },
    {
      id: 'SV003',
      destinationId: 'HA002',
      destinationName: 'Làng gốm Thanh Hà',
      name: 'Workshop nặn gốm truyền thống Thanh Hà',
      serviceType: 'Workshop làng nghề',
      description:
        'Trải nghiệm tạo hình đất sét bằng bàn xoay chân truyền thống và mang về sản phẩm gốm nhỏ làm kỷ niệm.',
      imageUrl: STITCH_IMAGES.HA002,
      pricePerGuestVnd: 120000,
      maxDailyCapacity: 15,
      status: 'ACTIVE',
      effectivelyBookable: true,
      version: 1,
      updatedAt: '2027-01-10T10:00:00+07:00',
    },
  ];

  const reviews: Review[] = [
    {
      id: 'RV001',
      destinationId: 'HA001',
      destinationName: 'Phố cổ Hội An',
      destinationPublic: true,
      userId: 'USR001',
      userName: 'Nguyễn Minh Anh',
      rating: 4,
      comment:
        'Phố cổ buổi tối rất đẹp và ấm cúng với ánh đèn lồng dọc sông Hoài. Nên đi sớm khoảng 16h30 để tránh đông khi chụp ảnh.',
      status: 'PENDING',
      createdAt: '2027-01-12T19:30:00+07:00',
      updatedAt: '2027-01-12T19:30:00+07:00',
    },
    {
      id: 'RV002',
      destinationId: 'HA001',
      destinationName: 'Phố cổ Hội An',
      destinationPublic: true,
      userId: 'USR002',
      userName: 'Nguyễn Hoàng Nam',
      rating: 5,
      comment:
        'Không gian kiến trúc cổ được bảo tồn rất tốt, các quán trà thảo mộc và xưởng đèn lồng mang lại trải nghiệm thư thái.',
      status: 'PUBLISHED',
      moderationReason: 'Nội dung phù hợp, đúng trải nghiệm thực tế.',
      moderatedBy: 'Trần Thu Hà (NV001)',
      moderatedAt: '2027-01-09T11:00:00+07:00',
      createdAt: '2027-01-08T20:15:00+07:00',
      updatedAt: '2027-01-09T11:00:00+07:00',
    },
    {
      id: 'RV003',
      destinationId: 'DN002',
      destinationName: 'Danh thắng Ngũ Hành Sơn',
      destinationPublic: true,
      userId: 'USR003',
      userName: 'Lê Thảo Vy',
      rating: 5,
      comment:
        'Động Huyền Không và Vọng Hải Đài rất đáng đi. Nên mang giày thể thao và đi buổi sáng cho mát.',
      status: 'PUBLISHED',
      moderationReason: 'Đánh giá hữu ích cho du khách.',
      moderatedBy: 'Trần Thu Hà (NV001)',
      moderatedAt: '2027-01-11T09:15:00+07:00',
      createdAt: '2027-01-10T15:40:00+07:00',
      updatedAt: '2027-01-11T09:15:00+07:00',
    },
  ];

  const lt001: Itinerary = {
    id: 'LT001',
    ownerId: 'USR001',
    title: 'Đà Nẵng – Hội An',
    region: 'Đà Nẵng',
    startDate: '2027-01-15',
    endDate: '2027-01-17',
    daysCount: 3,
    partySize: 2,
    budgetVnd: 3000000,
    budgetScopeNote:
      'Ngân sách áp dụng cho chi phí hoạt động tham quan của toàn đoàn (2 người) trong 3 ngày; không mặc nhiên bao gồm vé máy bay, khách sạn, ăn uống và di chuyển ngoài danh mục.',
    pace: 'MODERATE',
    categoryIds: ['CAT01', 'CAT03'],
    isDraft: false,
    draftExpiresAt: null,
    version: 1,
    totalEstimatedCostVnd: 570000,
    hasUnknownCostItems: false,
    createdAt: '2027-01-11T10:00:00+07:00',
    updatedAt: '2027-01-12T14:20:00+07:00',
    days: [
      {
        dayNumber: 1,
        date: '2027-01-15',
        activities: [
          {
            id: 'ACT001',
            dayNumber: 1,
            orderIndex: 0,
            type: 'DESTINATION',
            destinationId: 'DN002',
            destinationName: 'Danh thắng Ngũ Hành Sơn',
            title: 'Tham quan Ngũ Hành Sơn',
            startTime: '08:00',
            endTime: '10:30',
            estimatedGroupCostVnd: 80000,
            notes: 'Mang giày thể thao để leo bậc thang đá và tham quan động Huyền Không.',
          },
          {
            id: 'ACT002',
            dayNumber: 1,
            orderIndex: 1,
            type: 'DESTINATION',
            destinationId: 'HA001',
            destinationName: 'Phố cổ Hội An',
            title: 'Khám phá Phố cổ Hội An',
            startTime: '15:30',
            endTime: '20:00',
            estimatedGroupCostVnd: 300000,
            notes: 'Dạo phố đèn lồng buổi tối bên sông Hoài và tham quan Chùa Cầu.',
          },
        ],
      },
      {
        dayNumber: 2,
        date: '2027-01-16',
        activities: [
          {
            id: 'ACT003',
            dayNumber: 2,
            orderIndex: 0,
            type: 'DESTINATION',
            destinationId: 'HA002',
            destinationName: 'Làng gốm Thanh Hà',
            title: 'Tham quan Làng gốm Thanh Hà',
            startTime: '09:00',
            endTime: '11:30',
            estimatedGroupCostVnd: 70000,
            notes: 'Ghé xưởng gốm truyền thống và Công viên Đất Nung.',
          },
          {
            id: 'ACT004',
            dayNumber: 2,
            orderIndex: 1,
            type: 'REST_NOTE',
            destinationId: null,
            destinationName: null,
            title: 'Nghỉ trưa và trải nghiệm làm đèn lồng (theo đơn dịch vụ riêng)',
            startTime: '14:00',
            endTime: '16:00',
            estimatedGroupCostVnd: 0,
            notes: 'Nếu đã đặt dịch vụ SV001, chi phí được quản lý độc lập tại mục Đơn dịch vụ.',
          },
        ],
      },
      {
        dayNumber: 3,
        date: '2027-01-17',
        activities: [
          {
            id: 'ACT005',
            dayNumber: 3,
            orderIndex: 0,
            type: 'DESTINATION',
            destinationId: 'DN001',
            destinationName: 'Biển Mỹ Khê',
            title: 'Dạo biển sáng tại Biển Mỹ Khê',
            startTime: '06:30',
            endTime: '08:30',
            estimatedGroupCostVnd: 0,
            notes: 'Đón bình minh và đi dạo ven bờ cát trắng.',
          },
          {
            id: 'ACT006',
            dayNumber: 3,
            orderIndex: 1,
            type: 'DESTINATION',
            destinationId: 'DN004',
            destinationName: 'Bảo tàng Điêu khắc Chăm',
            title: 'Tham quan Bảo tàng Điêu khắc Chăm',
            startTime: '09:30',
            endTime: '11:30',
            estimatedGroupCostVnd: 120000,
            notes: 'Tìm hiểu nghệ thuật điêu khắc Chăm Pa trước khi kết thúc chuyến đi.',
          },
        ],
      },
    ],
  };

  const draft001: Itinerary = {
    id: 'DRAFT001',
    ownerId: 'USR001',
    title: 'Bản nháp Đà Nẵng – Sơn Trà cuối tuần',
    region: 'Đà Nẵng',
    startDate: '2027-02-06',
    endDate: '2027-02-07',
    daysCount: 2,
    partySize: 2,
    budgetVnd: 1500000,
    budgetScopeNote:
      'Ngân sách áp dụng cho chi phí hoạt động tham quan của toàn đoàn (2 người) trong 2 ngày; chưa bao gồm vé máy bay, khách sạn, ăn uống và di chuyển ngoài danh mục.',
    pace: 'SLOW',
    categoryIds: ['CAT02', 'CAT03'],
    isDraft: true,
    draftExpiresAt,
    version: 1,
    totalEstimatedCostVnd: 80000,
    hasUnknownCostItems: false,
    createdAt: iso(-60 * 60 * 1000),
    updatedAt: iso(-30 * 60 * 1000),
    days: [
      {
        dayNumber: 1,
        date: '2027-02-06',
        activities: [
          {
            id: 'ACT_D1',
            dayNumber: 1,
            orderIndex: 0,
            type: 'DESTINATION',
            destinationId: 'DN003',
            destinationName: 'Bán đảo Sơn Trà',
            title: 'Khám phá Bán đảo Sơn Trà',
            startTime: '08:30',
            endTime: '11:30',
            estimatedGroupCostVnd: 0,
            notes: 'Ghé chùa Linh Ứng và ngắm vịnh Đà Nẵng.',
          },
        ],
      },
      {
        dayNumber: 2,
        date: '2027-02-07',
        activities: [
          {
            id: 'ACT_D2',
            dayNumber: 2,
            orderIndex: 0,
            type: 'DESTINATION',
            destinationId: 'DN002',
            destinationName: 'Danh thắng Ngũ Hành Sơn',
            title: 'Tham quan Ngũ Hành Sơn',
            startTime: '08:00',
            endTime: '10:30',
            estimatedGroupCostVnd: 80000,
            notes: 'Tham quan Thủy Sơn và làng đá mỹ nghệ.',
          },
        ],
      },
    ],
  };

  const conversations: ChatConversation[] = [
    {
      id: 'CONV001',
      ownerId: 'USR001',
      title: 'Đà Nẵng – Hội An (LT001)',
      itineraryId: 'LT001',
      itineraryTitle: 'Đà Nẵng – Hội An',
      itineraryIsDraft: false,
      itineraryLinked: true,
      updatedAt: '2027-01-12T14:21:00+07:00',
      messages: [
        {
          id: 'MSG001',
          conversationId: 'CONV001',
          sender: 'USER',
          content: 'Buổi chiều ngày 1 ở Hội An nên sắp xếp tham quan đâu cho thuận đường?',
          status: 'SENT',
          createdAt: '2027-01-12T14:20:00+07:00',
        },
        {
          id: 'MSG002',
          conversationId: 'CONV001',
          sender: 'AI',
          content:
            'Với lịch trình Đà Nẵng – Hội An (2 khách, nhịp độ Vừa phải), bạn có thể ghé Làng gốm Thanh Hà (35.000đ/người) lúc 14:30 rồi di chuyển vào Phố cổ Hội An (150.000đ/người) khoảng 16:30 để dạo phố và ngắm đèn lồng buổi tối.',
          status: 'SENT',
          createdAt: '2027-01-12T14:21:00+07:00',
        },
      ],
    },
    {
      id: 'CONV002',
      ownerId: 'USR001',
      title: 'Hỏi đáp Đà Nẵng mùa xuân',
      itineraryId: null,
      itineraryTitle: null,
      itineraryLinked: false,
      updatedAt: '2027-01-06T09:15:00+07:00',
      messages: [
        {
          id: 'MSG003',
          conversationId: 'CONV002',
          sender: 'USER',
          content: 'Đi bán đảo Sơn Trà buổi sáng có cần mua vé vào cổng không?',
          status: 'SENT',
          createdAt: '2027-01-06T09:14:00+07:00',
        },
        {
          id: 'MSG004',
          conversationId: 'CONV002',
          sender: 'AI',
          content:
            'Bán đảo Sơn Trà hiện có chi phí tham khảo 0đ (miễn phí vào cổng). Bạn nên đi trong khung 07:30 – 17:30 và kiểm tra phanh xe trước khi lên dốc.',
          status: 'SENT',
          createdAt: '2027-01-06T09:15:00+07:00',
        },
      ],
    },
  ];

  const bookings: Booking[] = [
    {
      id: 'BK001',
      ownerId: 'USR001',
      customerName: 'Nguyễn Minh Anh',
      customerEmail: 'minh.anh@example.com',
      customerPhone: '0905 123 456',
      serviceId: 'SV001',
      serviceName: 'Trải nghiệm làm đèn lồng tại Hội An',
      destinationId: 'HA001',
      destinationName: 'Phố cổ Hội An',
      serviceDate: '2027-01-16',
      guestCount: 2,
      unitPriceSnapshotVnd: 150000,
      totalAmountVnd: 300000,
      status: 'PENDING_PAYMENT',
      paymentId: 'PAY001',
      paymentCode: 'TAI0001',
      paymentStatus: 'PENDING',
      expiresAt: bk001ExpiresAt,
      createdAt: bk001CreatedAt,
      updatedAt: bk001CreatedAt,
      canCustomerCancel: true,
      canStaffCancel: true,
      internalNotice:
        'Đơn dịch vụ nội bộ trên TripLoom. Hệ thống không khẳng định nhà cung cấp ngoài đã giữ chỗ riêng ngoài danh mục nội bộ.',
      timeline: [
        {
          id: 'TL001',
          timestamp: bk001CreatedAt,
          actor: 'Nguyễn Minh Anh',
          title: 'Tạo đơn dịch vụ và mã thanh toán TAI0001',
          detail: 'Giữ chỗ trong 15 phút cho 2 khách (300.000đ). Đang chờ ngân hàng xác nhận.',
        },
      ],
      supportNotes: [],
    },
    {
      id: 'BK002',
      ownerId: 'USR001',
      customerName: 'Nguyễn Minh Anh',
      customerEmail: 'minh.anh@example.com',
      customerPhone: '0905 123 456',
      serviceId: 'SV003',
      serviceName: 'Workshop nặn gốm truyền thống Thanh Hà',
      destinationId: 'HA002',
      destinationName: 'Làng gốm Thanh Hà',
      serviceDate: '2027-01-17',
      guestCount: 2,
      unitPriceSnapshotVnd: 120000,
      totalAmountVnd: 240000,
      status: 'CONFIRMED',
      paymentId: 'PAY002',
      paymentCode: 'TAI0002',
      paymentStatus: 'PAID',
      expiresAt: '2027-01-12T10:15:00+07:00',
      createdAt: '2027-01-12T10:00:00+07:00',
      updatedAt: '2027-01-12T10:04:00+07:00',
      canCustomerCancel: false,
      canStaffCancel: false,
      internalNotice:
        'Đơn dịch vụ nội bộ trên TripLoom đã được xác nhận thanh toán qua SePay.',
      timeline: [
        {
          id: 'TL002',
          timestamp: '2027-01-12T10:00:00+07:00',
          actor: 'Nguyễn Minh Anh',
          title: 'Tạo đơn dịch vụ BK002',
          detail: '2 khách × 120.000đ = 240.000đ. Mã thanh toán TAI0002.',
        },
        {
          id: 'TL003',
          timestamp: '2027-01-12T10:04:00+07:00',
          actor: 'SePay Webhook',
          title: 'Đã nhận thanh toán hợp lệ',
          detail: 'Khớp giao dịch SEPAY-20270112-001 số tiền 240.000đ. Đơn chuyển Đã xác nhận.',
        },
      ],
      supportNotes: [
        {
          id: 'SN001',
          author: 'Quản trị viên hệ thống',
          content: 'Khách xác nhận có mặt lúc 09:00 tại Làng gốm Thanh Hà.',
          createdAt: '2027-01-12T10:30:00+07:00',
        },
      ],
    },
  ];

  const payments: PaymentRecord[] = [
    {
      id: 'PAY001',
      paymentCode: 'TAI0001',
      bookingId: 'BK001',
      serviceName: 'Trải nghiệm làm đèn lồng tại Hội An',
      customerName: 'Nguyễn Minh Anh',
      expectedAmountVnd: 300000,
      receivedAmountVnd: 0,
      status: 'PENDING',
      expiresAt: bk001ExpiresAt,
      bankName: 'Ngân hàng Demo (Môi trường mô phỏng)',
      accountName: 'TRIPLOOM DEMO ACCOUNT',
      accountNumberDemo: '0000 1234 5678 (DEMO)',
      qrPlaceholderLabel: 'QR minh họa — Không chuyển khoản thật',
      updatedAt: bk001CreatedAt,
    },
    {
      id: 'PAY002',
      paymentCode: 'TAI0002',
      bookingId: 'BK002',
      serviceName: 'Workshop nặn gốm truyền thống Thanh Hà',
      customerName: 'Nguyễn Minh Anh',
      expectedAmountVnd: 240000,
      receivedAmountVnd: 240000,
      status: 'PAID',
      expiresAt: '2027-01-12T10:15:00+07:00',
      bankName: 'Ngân hàng Demo (Môi trường mô phỏng)',
      accountName: 'TRIPLOOM DEMO ACCOUNT',
      accountNumberDemo: '0000 1234 5678 (DEMO)',
      qrPlaceholderLabel: 'QR minh họa — Không chuyển khoản thật',
      updatedAt: '2027-01-12T10:04:00+07:00',
    },
  ];

  const paymentEvents: SePayEvent[] = [
    {
      id: 'EVT001',
      transactionRef: 'SEPAY-20270112-001',
      paymentId: 'PAY002',
      paymentCode: 'TAI0002',
      bookingId: 'BK002',
      transferContent: 'TAI0002 THANH TOAN BK002',
      amountReceivedVnd: 240000,
      expectedAmountVnd: 240000,
      receivingAccountDemo: '0000 1234 5678 (DEMO)',
      occurredAt: '2027-01-12T10:04:00+07:00',
      status: 'MATCHED',
      mismatchReason: null,
    },
    {
      id: 'EVT002',
      transactionRef: 'SEPAY-20270114-009',
      paymentId: null,
      paymentCode: null,
      bookingId: null,
      transferContent: 'CHUYEN KHOAN DAT TOUR HOI AN (SAI MA)',
      amountReceivedVnd: 350000,
      expectedAmountVnd: null,
      receivingAccountDemo: '0000 1234 5678 (DEMO)',
      occurredAt: '2027-01-14T16:45:00+07:00',
      status: 'NEEDS_REVIEW',
      mismatchReason: 'Không tìm thấy mã thanh toán khớp trong nội dung chuyển khoản.',
    },
  ];

  const staffMembers: StaffMember[] = [
    {
      id: 'STF_NV001',
      staffCode: 'NV001',
      fullName: 'Trần Thu Hà',
      email: 'ha.tran@triploom.vn',
      phone: '0912 222 333',
      notes: 'Phụ trách nội dung địa điểm miền Trung và kiểm duyệt đánh giá.',
      status: 'ACTIVE',
      hasActivatedBefore: true,
      permissions: ['STAFF_DESTINATION', 'STAFF_REVIEW'],
      emailDeliveryStatus: 'NOT_REQUIRED',
      emailDeliveryMessage: 'Tài khoản đã hoàn tất kích hoạt.',
      lastActivationSentAt: '2027-01-03T08:00:00+07:00',
      createdBy: 'ADM001 · Quản trị viên hệ thống',
      createdAt: '2027-01-03T08:00:00+07:00',
      lastLoginAt: '2027-01-15T08:10:00+07:00',
      updatedAt: '2027-01-12T09:00:00+07:00',
      authVersion: 1,
    },
    {
      id: 'STF_NV002',
      staffCode: 'NV002',
      fullName: 'Lê Quốc Bảo',
      email: 'bao.le@triploom.vn',
      phone: '0914 333 444',
      notes: 'Nhân viên hỗ trợ xử lý booking ca sáng.',
      status: 'INVITED',
      hasActivatedBefore: false,
      permissions: ['STAFF_BOOKING'],
      emailDeliveryStatus: 'SENT',
      emailDeliveryMessage: 'Email kích hoạt đã gửi tới bao.le@triploom.vn (hiệu lực 5 phút).',
      lastActivationSentAt: iso(-2 * 60 * 1000),
      createdBy: 'ADM001 · Quản trị viên hệ thống',
      createdAt: '2027-01-15T08:30:00+07:00',
      lastLoginAt: null,
      updatedAt: '2027-01-15T08:30:00+07:00',
      authVersion: 1,
    },
    {
      id: 'STF_NV003',
      staffCode: 'NV003',
      fullName: 'Phạm Quang Huy',
      email: 'huy.pham@triploom.vn',
      phone: '0918 555 666',
      notes: 'Tạm khóa do chuyển công tác nội bộ.',
      status: 'LOCKED',
      hasActivatedBefore: true,
      permissions: ['STAFF_PAYMENT_VIEW'],
      emailDeliveryStatus: 'NOT_REQUIRED',
      emailDeliveryMessage: 'Tài khoản đang ở trạng thái Đã khóa.',
      lastActivationSentAt: '2027-01-02T09:00:00+07:00',
      createdBy: 'ADM001 · Quản trị viên hệ thống',
      createdAt: '2027-01-02T09:00:00+07:00',
      lastLoginAt: '2027-01-13T17:45:00+07:00',
      updatedAt: '2027-01-14T16:00:00+07:00',
      authVersion: 2,
    },
    {
      id: 'STF_NV004',
      staffCode: 'NV004',
      fullName: 'Đỗ Hải Yến',
      email: 'yen.do@triploom.vn',
      phone: '0919 777 888',
      notes: 'Nhân viên kế toán chỉ đọc thông tin thanh toán SePay.',
      status: 'ACTIVE',
      hasActivatedBefore: true,
      permissions: ['STAFF_PAYMENT_VIEW'],
      emailDeliveryStatus: 'NOT_REQUIRED',
      emailDeliveryMessage: 'Tài khoản đã hoàn tất kích hoạt.',
      lastActivationSentAt: '2027-01-04T09:00:00+07:00',
      createdBy: 'ADM001 · Quản trị viên hệ thống',
      createdAt: '2027-01-04T09:00:00+07:00',
      lastLoginAt: '2027-01-15T08:05:00+07:00',
      updatedAt: '2027-01-14T10:00:00+07:00',
      authVersion: 1,
    },
  ];

  const auditLogs: AuditLogEntry[] = [
    {
      id: 'LOG001',
      timestamp: '2027-01-15T08:30:00+07:00',
      actorId: 'ADM001',
      actorName: 'Quản trị viên hệ thống',
      targetType: 'STAFF',
      targetId: 'STF_NV002',
      targetLabel: 'NV002 · Lê Quốc Bảo',
      action: 'STAFF_CREATED',
      actionLabel: 'Tạo tài khoản nhân viên',
      reason: 'Bổ sung nhân sự hỗ trợ đơn booking ca sáng.',
      beforeSummary: { 'Trạng thái': 'Chưa tồn tại' },
      afterSummary: {
        'Mã nhân viên': 'NV002',
        'Trạng thái': 'Chờ kích hoạt',
        'Nhóm quyền': 'Hỗ trợ booking',
      },
    },
    {
      id: 'LOG002',
      timestamp: '2027-01-14T16:00:00+07:00',
      actorId: 'ADM001',
      actorName: 'Quản trị viên hệ thống',
      targetType: 'STAFF',
      targetId: 'STF_NV003',
      targetLabel: 'NV003 · Phạm Quang Huy',
      action: 'STAFF_LOCKED',
      actionLabel: 'Khóa tài khoản nhân viên',
      reason: 'Nhân viên tạm ngưng công tác tại bộ phận đối soát.',
      beforeSummary: { 'Trạng thái': 'Đang hoạt động' },
      afterSummary: { 'Trạng thái': 'Đã khóa', 'Phiên đăng nhập': 'Đã thu hồi toàn bộ' },
    },
    {
      id: 'LOG003',
      timestamp: '2027-01-11T09:15:00+07:00',
      actorId: 'STF_NV001',
      actorName: 'Trần Thu Hà (NV001)',
      targetType: 'REVIEW',
      targetId: 'RV003',
      targetLabel: 'Đánh giá RV003 · Ngũ Hành Sơn',
      action: 'REVIEW_MODERATED',
      actionLabel: 'Duyệt công khai đánh giá',
      reason: 'Đánh giá hữu ích, tuân thủ quy chuẩn cộng đồng.',
      beforeSummary: { 'Trạng thái': 'Chờ duyệt' },
      afterSummary: { 'Trạng thái': 'Đã công khai' },
    },
  ];

  // Tạo sẵn mã OTP kích hoạt cho NV002 để có thể kiểm thử T06 ngay
  const otpCodes: MockOtpCodeRecord[] = [
    {
      id: 'OTP_SEED_NV002',
      email: 'bao.le@triploom.vn',
      purpose: 'STAFF_ACTIVATION',
      code: '246810',
      createdAt: iso(-60 * 1000),
      expiresAt: iso(4 * 60 * 1000),
      used: false,
      invalidated: false,
      failedAttempts: 0,
    },
  ];

  return {
    schemaVersion: MOCK_SCHEMA_VERSION,
    currentUserId: null,
    currentAuthVersion: null,
    accounts,
    categories,
    destinations,
    services,
    reviews,
    favoritesByUser: {
      USR001: ['HA001', 'DN001'],
    },
    tripDraftRequests: [],
    itineraries: [lt001, draft001],
    conversations,
    bookings,
    payments,
    paymentEvents,
    bookingIdempotencyMap: {},
    staffMembers,
    auditLogs,
    otpCodes,
    otpRateBuckets: {},
    devFlags: {
      simulateAiFailure: false,
      simulateNetworkFailure: false,
      simulateEmailFailure: false,
    },
    counters: {
      booking: 3,
      paymentCode: 3,
      event: 3,
      itinerary: 2,
      draft: 2,
      review: 4,
      conversation: 3,
      audit: 4,
      category: 5,
      destination: 6,
      service: 4,
    },
  };
}
