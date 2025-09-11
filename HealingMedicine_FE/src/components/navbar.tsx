import React from "react";
import { PhoneIcon } from "@heroicons/react/24/outline";
import {
  Navbar,
  NavbarBrand,
  NavbarContent,
  NavbarItem,
  Link,
  Input,
} from "@heroui/react";

const AppNavbar = () => {
  return (
    <header className="w-full shadow bg-white">
      {/* Top bar */}
      <div className="bg-green-700 text-white text-sm">
        <div className="max-w-7xl mx-auto px-4 flex justify-between items-center py-2">
          {/* Left side */}
          <div className="flex items-center space-x-6">
            <a href="tel:02473008866" className="flex items-center space-x-2">
              <PhoneIcon className="w-4 h-4" />
              <span>Hỗ trợ tư vấn: 024 7300 8866</span>
            </a>
            <a href="tel:1900636555" className="flex items-center space-x-2">
              <PhoneIcon className="w-4 h-4" />
              <span>Cấp cứu: 1900 636 555</span>
            </a>
          </div>

          {/* Right side */}
          <div className="flex items-center space-x-4">
            <a href="/offers" className="bg-green-600 hover:bg-green-500 px-3 py-1 rounded text-white text-xs">
              Ưu đãi nổi bật
            </a>
            <select
              name="language"
              className="bg-transparent text-white uppercase text-sm"
            >
              <option value="vi">VI</option>
              <option value="en">EN</option>
              <option value="kr">KR</option>
              <option value="cn">CN</option>
            </select>
            <Link href="/signup" className="text-white">
              Đăng ký
            </Link>
            <Link href="/login" className="text-white">
              Đăng nhập
            </Link>
          </div>
        </div>
      </div>

      {/* Main Navbar */}
      <Navbar isBordered className="flex items-center h-30 px-4">
  {/* Logo */}
  <NavbarBrand>
    <Link href="/" className="flex items-center">
      <img
        src="/unnamed.png"
        alt="Logo"
        className="h-29 max-h-[8rem] w-auto object-contain"
      />
    </Link>
  </NavbarBrand>

  {/* Menu Items */}
  <NavbarContent className="hidden sm:flex gap-6" justify="center">
    <NavbarItem>
      <Link href="/about" color="foreground">
        Giới thiệu
      </Link>
    </NavbarItem>
    <NavbarItem>
      <Link href="/services" color="foreground">
        Dịch vụ
      </Link>
    </NavbarItem>
    <NavbarItem>
      <Link href="/doctors" color="foreground">
        Danh sách bác sĩ
      </Link>
    </NavbarItem>
    <NavbarItem>
      <Link href="/departments" color="foreground">
        Chuyên khoa
      </Link>
    </NavbarItem>
    <NavbarItem>
      <Link href="/news" color="foreground">
        Tin tức & Ưu đãi
      </Link>
    </NavbarItem>
    <NavbarItem>
      <Link href="/contact" color="foreground">
        Liên hệ
      </Link>
    </NavbarItem>
  </NavbarContent>

  {/* Search + Action */}
  <NavbarContent justify="end">
    <NavbarItem className="hidden lg:flex">
      <Input
        placeholder="Tìm kiếm..."
        size="sm"
        className="w-48"
      />
    </NavbarItem>
  </NavbarContent>
</Navbar>
    </header>
  );
};

export default AppNavbar;