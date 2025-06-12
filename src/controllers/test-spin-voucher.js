import axios from "axios";

const API_URL = "http://localhost:5000/api/vouchers/spin";
const TOTAL_SPINS = 100; // Tăng lên để test chính xác

const count = {};

async function testSpin() {
  console.log(`🎯 Testing ${TOTAL_SPINS} spins...`);
  
  for (let i = 0; i < TOTAL_SPINS; i++) {
    try {
      const res = await axios.get(API_URL);
      const code = res.data.voucher ? res.data.voucher.Code : "none";
      count[code] = (count[code] || 0) + 1;
      
      if ((i + 1) % 100 === 0) {
        console.log(`Progress: ${i + 1}/${TOTAL_SPINS}`);
      }
    } catch (err) {
      console.error("Spin error:", err.message);
    }
  }
  
  console.log("\n🎉 RESULTS:");
  console.table(
    Object.entries(count).map(([code, value]) => ({
      Code: code,
      Wins: value,
      Percentage: ((value / TOTAL_SPINS) * 100).toFixed(4) + "%"
    }))
  );
  
  // Phân tích kết quả
  console.log("\n📊 ANALYSIS:");
  Object.entries(count).forEach(([code, wins]) => {
    const percent = ((wins / TOTAL_SPINS) * 100).toFixed(4);
    console.log(`${code}: ${wins} wins (${percent}%)`);
  });
}

testSpin();