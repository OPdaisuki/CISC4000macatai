-- 直接在根目录创建
-- 酒店表
CREATE TABLE IF NOT EXISTS hotels (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name_zh VARCHAR(255),
  address_zh TEXT,
  license_no VARCHAR(50)
);

-- 餐厅表
CREATE TABLE IF NOT EXISTS restaurants (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name_zh VARCHAR(255),
  address_zh TEXT,
  license_type VARCHAR(50)
);