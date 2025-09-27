#!/usr/bin/env python3
"""
測試所有女宿舍配置
驗證機器數量是否正確
"""

import sys
sys.path.append('.')
from simple_simulator import SimpleHardwareController

def test_dormitory_config():
    """測試所有宿舍配置"""
    
    print("🏭 女宿舍洗衣機配置測試")
    print("=" * 50)
    
    # 預期的機器數量
    expected_counts = {
        "誠軒": {"washing": 23, "drying": 12, "total": 35},
        "樸軒": {"washing": 11, "drying": 11, "total": 22},
        "華軒": {"washing": 5, "drying": 1, "total": 6},
        "怡軒": {"washing": 0, "drying": 0, "total": 0},
        "勤軒": {"washing": 6, "drying": 2, "total": 8}
    }
    
    all_pass = True
    
    for dorm_name in expected_counts:
        print(f"\n🏠 測試 {dorm_name}:")
        
        try:
            # 創建控制器但不啟動報告線程
            controller = SimpleHardwareController.__new__(SimpleHardwareController)
            controller.region_name = dorm_name
            controller.running = False  # 不啟動報告線程
            machines = controller._get_static_machines()
            
            # 統計機器數量
            washing_count = sum(1 for m in machines if m["machine_type"] == "washing")
            drying_count = sum(1 for m in machines if m["machine_type"] == "drying")
            total_count = len(machines)
            
            expected = expected_counts[dorm_name]
            
            print(f"   洗衣機: {washing_count}/{expected['washing']} {'✅' if washing_count == expected['washing'] else '❌'}")
            print(f"   烘衣機: {drying_count}/{expected['drying']} {'✅' if drying_count == expected['drying'] else '❌'}")
            print(f"   總計: {total_count}/{expected['total']} {'✅' if total_count == expected['total'] else '❌'}")
            
            # 顯示部分機器代碼作為示例
            if machines:
                print(f"   示例機器:")
                for i, machine in enumerate(machines[:3]):
                    type_emoji = "🫧" if machine["machine_type"] == "washing" else "🌪️"
                    print(f"     {type_emoji} {machine['machine_code']} - {machine['location']}")
                if len(machines) > 3:
                    print(f"     ... 還有 {len(machines) - 3} 台機器")
            
            # 檢查是否通過測試
            if (washing_count != expected['washing'] or 
                drying_count != expected['drying'] or 
                total_count != expected['total']):
                all_pass = False
                
        except Exception as e:
            print(f"   ❌ 測試失敗: {e}")
            all_pass = False
    
    print(f"\n{'=' * 50}")
    if all_pass:
        print("🎉 所有宿舍配置測試通過！")
    else:
        print("❌ 部分宿舍配置有誤，請檢查")
    print("=" * 50)
    
    return all_pass

if __name__ == "__main__":
    test_dormitory_config()
