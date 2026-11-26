/**
 * Tài nguyên ảnh nội bộ (đồng bộ theo bộ thiết kế TripLoom, không phụ thuộc URL tạm dễ hết hạn).
 * Mọi thẻ <img> đều có fallback SVG bổ sung qua bindImageFallbacks khi quản trị viên nhập URL ngoài lỗi.
 */
export const STITCH_IMAGES = {
  heroVietnam: '/images/hero-vietnam.svg',
  DN001: '/images/dn001-my-khe.svg',
  DN002: '/images/dn002-ngu-hanh-son.svg',
  DN003: '/images/dn003-son-tra.svg',
  DN004: '/images/dn004-cham-museum.svg',
  HA001: '/images/ha001-hoi-an.svg',
  HA002: '/images/ha002-thanh-ha.svg',
  SV001: '/images/sv001-lantern.svg',
  avatarMinhAnh: '/images/avatar-minh-anh.svg',
} as const;
