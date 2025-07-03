# Hướng dẫn tích hợp Zalo Mini App Authentication

## Các API mới đã được thêm vào

### 1. API Đăng nhập với Zalo
**Endpoint:** `POST /api/auth/zalo-login`

**Body:**
```json
{
  "accessToken": "zalo_access_token_from_frontend"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Đăng nhập thành công",
  "user": {
    "userId": 123,
    "zaloId": "zalo_user_id",
    "username": "Tên User",
    "fullname": "Họ và tên đầy đủ",
    "avatar": "url_to_avatar"
  }
}
```

### 2. API Lấy thông tin user hiện tại
**Endpoint:** `GET /api/auth/me?zaloId={zaloId}`

**Response:**
```json
{
  "success": true,
  "user": {
    "userid": 123,
    "zaloid": "zalo_user_id",
    "username": "Tên User",
    "fullname": "Họ và tên",
    "phone": "0123456789",
    "avatar": "url_to_avatar",
    // ... các thông tin khác
  }
}
```

### 3. API Lấy voucher với số lượng đã thu thập
**Endpoint:** `GET /api/vouchers/category/{category}/user/{zaloId}`

**Response:**
```json
[
  {
    "voucherid": "v1",
    "code": "ABC123",
    "description": "Voucher giảm giá",
    "quantity": 100,
    "user_collected_count": 5,
    // ... các thông tin khác
  }
]
```

### 4. API Lấy tất cả voucher với số lượng đã thu thập
**Endpoint:** `GET /api/vouchers/with-user-count?zaloId={zaloId}`

### 5. API Thống kê user
**Endpoint:** `GET /api/vouchers/user-stats/{zaloId}`

**Response:**
```json
{
  "success": true,
  "user": {
    "userId": 123,
    "zaloId": "zalo_user_id",
    "username": "Tên User",
    // ... thông tin user
  },
  "stats": {
    "totalCollected": 10,
    "usedVouchers": 3,
    "vouchersByCategory": [
      {"category": "wheel", "count": 5},
      {"category": "special", "count": 5}
    ]
  }
}
```

## Cách sử dụng trong Frontend

### 1. Đăng nhập với Zalo
```javascript
import { zmp } from 'zmp-sdk';

// Lấy access token từ Zalo
const getZaloAccessToken = async () => {
  try {
    const token = await zmp.getAccessToken();
    return token;
  } catch (error) {
    console.error('Lỗi khi lấy access token:', error);
  }
};

// Đăng nhập vào hệ thống
const loginWithZalo = async () => {
  try {
    const accessToken = await getZaloAccessToken();
    
    const response = await fetch('/api/auth/zalo-login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ accessToken })
    });
    
    const result = await response.json();
    
    if (result.success) {
      // Lưu thông tin user vào localStorage hoặc state management
      localStorage.setItem('zaloId', result.user.zaloId);
      localStorage.setItem('userInfo', JSON.stringify(result.user));
      
      return result.user;
    }
  } catch (error) {
    console.error('Lỗi đăng nhập:', error);
  }
};
```

### 2. Lấy thông tin user hiện tại
```javascript
const getCurrentUser = async (zaloId) => {
  try {
    const response = await fetch(`/api/auth/me?zaloId=${zaloId}`);
    const result = await response.json();
    
    if (result.success) {
      return result.user;
    }
  } catch (error) {
    console.error('Lỗi khi lấy thông tin user:', error);
  }
};
```

### 3. Lấy voucher với số lượng đã thu thập
```javascript
const getVouchersWithUserCount = async (category, zaloId) => {
  try {
    const response = await fetch(`/api/vouchers/category/${category}/user/${zaloId}`);
    const vouchers = await response.json();
    
    // Vouchers sẽ có thêm field 'user_collected_count'
    return vouchers;
  } catch (error) {
    console.error('Lỗi khi lấy vouchers:', error);
  }
};
```

### 4. Hiển thị số lượng đã thu thập
```javascript
const VoucherCard = ({ voucher }) => {
  return (
    <div className="voucher-card">
      <h3>{voucher.description}</h3>
      <p>Mã: {voucher.code}</p>
      <p>Giảm giá: {voucher.discount}%</p>
      {/* Hiển thị số lượng đã thu thập thay vì quantity */}
      <p>Đã thu thập: {voucher.user_collected_count}</p>
      {/* Có thể hiển thị cả hai */}
      <p>Còn lại trong kho: {voucher.quantity}</p>
    </div>
  );
};
```

### 5. Khởi tạo app với Zalo authentication
```javascript
const App = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const initApp = async () => {
      try {
        // Kiểm tra đã có thông tin user trong localStorage chưa
        const savedZaloId = localStorage.getItem('zaloId');
        
        if (savedZaloId) {
          // Lấy thông tin user từ server
          const userInfo = await getCurrentUser(savedZaloId);
          if (userInfo) {
            setUser(userInfo);
          } else {
            // Nếu không lấy được thông tin, đăng nhập lại
            await loginWithZalo();
          }
        } else {
          // Chưa có thông tin, đăng nhập với Zalo
          await loginWithZalo();
        }
      } catch (error) {
        console.error('Lỗi khởi tạo app:', error);
      } finally {
        setLoading(false);
      }
    };
    
    initApp();
  }, []);
  
  if (loading) {
    return <div>Đang tải...</div>;
  }
  
  return (
    <div className="app">
      {user ? (
        <div>
          <h1>Xin chào, {user.fullname}!</h1>
          {/* Nội dung app */}
        </div>
      ) : (
        <div>
          <button onClick={loginWithZalo}>
            Đăng nhập với Zalo
          </button>
        </div>
      )}
    </div>
  );
};
```

## TÓM TẮT NHỮNG VIỆC CẦN LÀM Ở FRONTEND

### 🔥 CÁC API MỚI ĐÃ THÊM:

1. **`POST /api/auth/zalo-login`** - Đăng nhập với Zalo access token
2. **`GET /api/auth/me?zaloId={zaloId}`** - Lấy thông tin user hiện tại
3. **`GET /api/vouchers/category/{category}/user/{zaloId}`** - Lấy voucher theo category + số lượng đã thu thập
4. **`GET /api/vouchers/with-user-count?zaloId={zaloId}`** - Lấy tất cả voucher + số lượng đã thu thập
5. **`GET /api/vouchers/user-stats/{zaloId}`** - Thống kê chi tiết user

### 🎯 NHỮNG VIỆC CẦN SỬA Ở FRONTEND:

#### 1. **Thay đổi cách lấy voucher** (QUAN TRỌNG NHẤT)
```javascript
// CŨ: 
const vouchers = await fetch('/api/vouchers/category/wheel');

// MỚI: (có thêm user_collected_count)
const vouchers = await fetch(`/api/vouchers/category/wheel/user/${zaloId}`);
```

#### 2. **Thêm logic đăng nhập Zalo thật**
```javascript
import { zmp } from 'zmp-sdk';

const loginWithZalo = async () => {
  const accessToken = await zmp.getAccessToken();
  const response = await fetch('/api/auth/zalo-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accessToken })
  });
  const result = await response.json();
  // Lưu result.user.zaloId vào state/localStorage
};
```

#### 3. **Sử dụng zaloId thật thay vì userid giả**
```javascript
// CŨ:
const testUserId = 'testid2';

// MỚI:
const zaloId = localStorage.getItem('zaloId'); // Lấy từ đăng nhập Zalo
```

#### 4. **Cập nhật hiển thị số lượng voucher**
```javascript
const VoucherCard = ({ voucher }) => (
  <div>
    <h3>{voucher.description}</h3>
    {/* Hiển thị số lượng user đã thu thập */}
    <p>Bạn đã có: {voucher.user_collected_count}</p>
    {/* Vẫn có thể hiển thị số lượng trong kho */}
    <p>Còn lại: {voucher.quantity}</p>
  </div>
);
```

#### 5. **Thêm trang thống kê user** (Tùy chọn)
```javascript
const UserStats = ({ zaloId }) => {
  const [stats, setStats] = useState(null);
  
  useEffect(() => {
    fetch(`/api/vouchers/user-stats/${zaloId}`)
      .then(res => res.json())
      .then(setStats);
  }, [zaloId]);
  
  return (
    <div>
      <p>Tổng voucher: {stats?.stats.totalCollected}</p>
      <p>Đã dùng: {stats?.stats.usedVouchers}</p>
    </div>
  );
};
```

### 🚀 THAY ĐỔI TỐI THIỂU CẦN THIẾT:

1. **Thay tất cả API call lấy voucher** từ `/api/vouchers/category/wheel` thành `/api/vouchers/category/wheel/user/${zaloId}`

2. **Thêm logic lấy zaloId từ Zalo SDK** thay vì dùng userid giả

3. **Cập nhật hiển thị** từ `voucher.quantity` thành `voucher.user_collected_count`

### 📝 FILE CẦN SỬA:
- File component hiển thị voucher (thay API call + hiển thị)
- File xử lý authentication (thêm Zalo login)
- File quay thưởng/claim voucher (dùng zaloId thật)

## Lưu ý quan trọng

1. **Access Token:** Access token từ Zalo có thời hạn sử dụng, cần handle refresh token nếu cần thiết.

2. **Privacy:** Một số thông tin như số điện thoại cần quyền đặc biệt từ Zalo, không phải app nào cũng lấy được.

3. **Caching:** Nên cache thông tin user ở localStorage/sessionStorage để tránh call API liên tục.

4. **Error Handling:** Luôn có try-catch để xử lý lỗi network hoặc lỗi từ Zalo API.

5. **Testing:** Trong môi trường development, có thể dùng API `/auth/register` cũ để test với user giả.
