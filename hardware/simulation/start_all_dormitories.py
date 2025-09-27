#!/usr/bin/env python3
"""
自動啟動所有女宿舍洗衣機模擬器
一次性啟動誠軒、樸軒、華軒、勤軒的模擬器
"""

import os
import sys
import threading
import time
from datetime import datetime
sys.path.append('.')
from simple_simulator import SimpleHardwareController


DEFAULT_SERVER_URL = os.environ.get('SIMULATOR_SERVER_URL', 'http://localhost:3000')
DEFAULT_CLIENT_URL = os.environ.get('SIMULATOR_CLIENT_URL', 'http://localhost:5173')


def start_dormitory_simulator(dorm_name, server_url=None):
    """啟動指定宿舍的模擬器"""
    try:
        print(f"正在啟動 {dorm_name} 模擬器...")
        
        # 創建控制器
        target_url = (server_url or DEFAULT_SERVER_URL).rstrip('/')
        controller = SimpleHardwareController(dorm_name, target_url)
        
        print(f"{dorm_name} 模擬器啟動成功")
        print(f"   管理機器數: {len(controller.machines)}")
        
        # 顯示機器統計
        washing_count = sum(1 for m in controller.machines if m["machine_type"] == "washing")
        drying_count = sum(1 for m in controller.machines if m["machine_type"] == "drying")
        print(f"   洗衣機: {washing_count} 台")
        print(f"   烘衣機: {drying_count} 台")
        
        return controller
        
    except Exception as e:
        print(f"{dorm_name} 模擬器啟動失敗: {e}")
        return None


def main():
    """主函數 - 啟動所有宿舍模擬器"""
    print("女宿舍洗衣機模擬器 - 全自動啟動")
    print("=" * 60)
    print("這個腳本會自動啟動所有女宿舍的洗衣機模擬器")
    print("• 誠軒: 35台機器 (23洗+12烘)")
    print("• 樸軒: 22台機器 (11洗+11烘)")
    print("• 華軒: 6台機器 (5洗+1烘)")
    print("• 勤軒: 8台機器 (6洗+2烘)")
    print("• 怡軒: 0台機器 (跳過)")
    print()
    
    # 檢查是否為自動模式 (從命令行參數)
    auto_mode = len(sys.argv) > 1 and sys.argv[1] == "--auto"
    
    # 選擇伺服器
    if auto_mode:
        server_url = DEFAULT_SERVER_URL
        print("自動模式: 使用環境變數 SIMULATOR_SERVER_URL 連接")
    else:
        print("請選擇要連接的伺服器:")
        print(f"1. 使用預設服務器 ({DEFAULT_SERVER_URL})")
        print("2. 自訂服務器 URL")

        try:
            server_choice = input("請輸入選項 (1-2, 預設1): ").strip() or "1"
        except (EOFError, KeyboardInterrupt):
            print("使用預設選項: 1")
            server_choice = "1"

        if server_choice == "2":
            custom_url = input("請輸入服務器URL (例如 https://example.com:3000): ").strip()
            server_url = custom_url or DEFAULT_SERVER_URL
        else:
            server_url = DEFAULT_SERVER_URL
    
    print(f"\n連接至: {server_url}")
    print()
    
    # 要啟動的宿舍列表（排除怡軒因為沒有機器）
    dormitories = ["誠軒", "樸軒", "華軒", "勤軒"]
    controllers = {}
    
    print(f"開始啟動 {len(dormitories)} 個宿舍模擬器...")
    print("=" * 60)
    
    # 依序啟動各宿舍模擬器
    for i, dorm in enumerate(dormitories, 1):
        print(f"\n[{i}/{len(dormitories)}] 啟動 {dorm} 模擬器...")
        controller = start_dormitory_simulator(dorm, server_url)
        
        if controller:
            controllers[dorm] = controller
            print(f"{dorm} 啟動完成")
        else:
            print(f"{dorm} 啟動失敗")
        
        # 給每個模擬器一點啟動時間
        if i < len(dormitories):
            print("等待 1 秒後啟動下一個...")
            time.sleep(1)
    
    print("\n" + "=" * 60)
    print("所有宿舍模擬器啟動完成")
    print()
    
    # 顯示總結統計
    total_machines = 0
    total_washing = 0
    total_drying = 0
    
    print("啟動結果總結:")
    for dorm, controller in controllers.items():
        if controller:
            washing_count = sum(1 for m in controller.machines if m["machine_type"] == "washing")
            drying_count = sum(1 for m in controller.machines if m["machine_type"] == "drying")
            total_count = len(controller.machines)
            
            total_machines += total_count
            total_washing += washing_count
            total_drying += drying_count
            
            print(f"{dorm}: {total_count} 台 ({washing_count} 洗 + {drying_count} 烘)")
        else:
            print(f"{dorm}: 啟動失敗")
    
    print(f"\n總計: {total_machines} 台機器 ({total_washing} 洗 + {total_drying} 烘)")
    print("所有模擬器每30秒自動向伺服器報告狀態")
    print("現在可以到前端查看所有機器狀態了")
    
    print("\n" + "=" * 60)
    if auto_mode:
        print("自動模式運行中...")
        print("模擬器將持續運行，按 Ctrl+C 停止")
        print("=" * 60)
        
        # 自動模式：只運行，不等待用戶輸入
        try:
            print("每30秒顯示一次狀態...")
            while True:
                time.sleep(30)
                print(f"\n自動狀態報告 - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
                print("-" * 40)
                
                for dorm, controller in controllers.items():
                    if controller:
                        status_counts = {}
                        for machine in controller.machines:
                            status = machine["status"]
                            status_counts[status] = status_counts.get(status, 0) + 1
                        
                        available = status_counts.get("available", 0)
                        in_use = status_counts.get("in_use", 0)
                        total = len(controller.machines)
                        print(f"{dorm}: {available} 可用 / {total} 總計 (使用中: {in_use})")
                
                print("-" * 40)
        except KeyboardInterrupt:
            print(f"\n收到停止信號...")
    else:
        print("控制指令:")
        print("  Enter     - 顯示所有宿舍狀態")
        print("  status    - 顯示詳細狀態")
        print("  list      - 列出所有機器")
        print("  help      - 顯示說明")
        print("  quit      - 退出所有模擬器")
        print("=" * 60)
    
    # 命令行互動循環
    try:
        while True:
            try:
                command = input(f"\n[全部宿舍] 請輸入指令 (Enter=status): ").strip().lower()
            except EOFError:
                print("\n自動顯示狀態...")
                command = "status"
            
            if command in ["quit", "exit", "q"]:
                print("\n正在停止所有模擬器...")
                for dorm, controller in controllers.items():
                    if controller:
                        controller.stop()
                        print(f"{dorm} 模擬器已停止")
                break
                
            elif command == "" or command == "status":
                print(f"\n所有宿舍狀態 - {datetime.now().strftime('%H:%M:%S')}")
                print("=" * 60)
                
                for dorm, controller in controllers.items():
                    if controller:
                        print(f"\n{dorm} ({len(controller.machines)} 台機器):")
                        
                        # 統計狀態
                        status_counts = {}
                        for machine in controller.machines:
                            status = machine["status"]
                            status_counts[status] = status_counts.get(status, 0) + 1
                        
                        # 顯示狀態分布
                        for status, count in status_counts.items():
                            print(f"   {status}: {count} 台")
                
            elif command == "list":
                print(f"\n所有機器列表:")
                print("=" * 60)
                
                for dorm, controller in controllers.items():
                    if controller:
                        print(f"\n{dorm}:")
                        for machine in controller.machines[:5]:  # 只顯示前5台
                            print(f"   {machine['machine_code']}")
                        
                        if len(controller.machines) > 5:
                            print(f"   ... 還有 {len(controller.machines) - 5} 台機器")
                
            elif command == "help":
                print("\n全自動模擬器說明:")
                print("=" * 60)
                print("• 這個腳本同時管理所有女宿舍的洗衣機模擬器")
                print("• 每個宿舍的模擬器都會自動向伺服器報告狀態")
                print("• 前端會即時顯示所有宿舍的機器狀態")
                print("• 可以透過前端或 LINE Bot 與系統互動")
                print()
                print("宿舍配置:")
                print("  誠軒: 35 台 (23 洗 + 12 烘) - 2F:1 洗, 3F-13F: 每層 2 洗 + 1 烘")
                print("  樸軒: 22 台 (11 洗 + 11 烘) - 1F-11F: 每層 1 洗 + 1 烘")
                print("  華軒: 6 台 (5 洗 + 1 烘) - 1F: 2 洗 + 1 烘, 2F-4F: 每層 1 洗")
                print("  勤軒: 8 台 (6 洗 + 2 烘) - 1F: 3 洗 + 2 烘, 2F-4F: 每層 1 洗")
                print()
                print("訪問地址:")
                print(f"  前端: {DEFAULT_CLIENT_URL}")
                print(f"  後端: {server_url}")
                
            else:
                print("未知指令")
                print("可用指令: status, list, help, quit")
                
    except KeyboardInterrupt:
        print("\n\n收到中斷信號，正在停止所有模擬器...")
        for dorm, controller in controllers.items():
            if controller:
                controller.stop()
        print("所有模擬器已停止")


if __name__ == "__main__":
    main()
