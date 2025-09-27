#!/usr/bin/env python3
"""
簡化的硬體控制器模擬器
支援多種洗衣機狀態模擬和手動控制
"""

import os
import sys
import json
import time
import threading
import random
import requests
from datetime import datetime, timedelta


class SimpleHardwareController:
    """硬體控制器 - 支援多種狀態模擬和手動控制"""
    
    def __init__(self, region_name, server_url=None, api_key=None):
        self.region_name = region_name
        default_server_url = os.environ.get('SIMULATOR_SERVER_URL', 'http://localhost:3000')
        default_api_key = os.environ.get('HARDWARE_API_KEY', 'hardware-demo-key')
        self.server_url = (server_url or default_server_url).rstrip('/')
        self.api_key = api_key or default_api_key
        self.controller_id = f"CTRL_{region_name}_001"
        
        # 生成機器配置
        self.machines = self._get_static_machines()
        
        # 初始化所有機器為可用狀態
        for machine in self.machines:
            machine["status"] = "available"
            machine["remaining_time"] = 0
            machine["last_update"] = datetime.now().isoformat()
        
        # 啟動狀態報告線程
        self.running = True
        self._start_status_reporter()
    
    def _generate_chengxuan_machines(self):
        """生成誠軒宿舍機器配置
        洗衣機：2F一台，3F-13F每層樓兩台
        烘衣機：2F-13F每層樓一台
        """
        machines = []
        
        # 2樓洗衣機（1台）
        machines.append({
            "machine_code": "W-CX-2F-01",
            "machine_type": "washing",
            "location": "誠軒2樓洗衣間"
        })
        
        # 3F-13F洗衣機（每層2台）
        for floor in range(3, 14):
            machines.extend([
                {
                    "machine_code": f"W-CX-{floor}F-A",
                    "machine_type": "washing",
                    "location": f"誠軒{floor}樓洗衣間"
                },
                {
                    "machine_code": f"W-CX-{floor}F-B",
                    "machine_type": "washing", 
                    "location": f"誠軒{floor}樓洗衣間"
                }
            ])
        
        # 2F-13F烘衣機（每層1台）
        for floor in range(2, 14):
            machines.append({
                "machine_code": f"D-CX-{floor}F-01",
                "machine_type": "drying",
                "location": f"誠軒{floor}樓洗衣間"
            })
        
        return machines
    
    def _generate_puxuan_machines(self):
        """生成樸軒宿舍機器配置
        洗衣機：1F-11F每層樓一台
        烘衣機：1F-11F每層樓一台
        """
        machines = []
        
        # 1F-11F洗衣機和烘衣機（每層各1台）
        for floor in range(1, 12):
            machines.extend([
                {
                    "machine_code": f"W-PX-{floor}F-01",
                    "machine_type": "washing",
                    "location": f"樸軒{floor}樓洗衣間"
                },
                {
                    "machine_code": f"D-PX-{floor}F-01",
                    "machine_type": "drying",
                    "location": f"樸軒{floor}樓洗衣間"
                }
            ])
        
        return machines
    
    def _generate_huaxuan_machines(self):
        """生成華軒宿舍機器配置
        洗衣機：1F兩台，2F-4F每層樓一台
        烘衣機：1F一台
        """
        machines = []
        
        # 1樓洗衣機（2台）
        machines.extend([
            {
                "machine_code": "W-HX-1F-01",
                "machine_type": "washing",
                "location": "華軒1樓洗衣間"
            },
            {
                "machine_code": "W-HX-1F-02",
                "machine_type": "washing",
                "location": "華軒1樓洗衣間"
            }
        ])
        
        # 2F-4F洗衣機（每層1台）
        for floor in range(2, 5):
            machines.append({
                "machine_code": f"W-HX-{floor}F-01",
                "machine_type": "washing",
                "location": f"華軒{floor}樓洗衣間"
            })
        
        # 1樓烘衣機（1台）
        machines.append({
            "machine_code": "D-HX-1F-01",
            "machine_type": "drying",
            "location": "華軒1樓洗衣間"
        })
        
        return machines
    
    def _generate_qinxuan_machines(self):
        """生成勤軒宿舍機器配置
        洗衣機：1F三台，2F-4F每層樓一台
        烘衣機：1F兩台
        """
        machines = []
        
        # 1樓洗衣機（3台）
        machines.extend([
            {
                "machine_code": "W-QX-1F-01",
                "machine_type": "washing",
                "location": "勤軒1樓洗衣間"
            },
            {
                "machine_code": "W-QX-1F-02",
                "machine_type": "washing",
                "location": "勤軒1樓洗衣間"
            },
            {
                "machine_code": "W-QX-1F-03",
                "machine_type": "washing",
                "location": "勤軒1樓洗衣間"
            }
        ])
        
        # 2F-4F洗衣機（每層1台）
        for floor in range(2, 5):
            machines.append({
                "machine_code": f"W-QX-{floor}F-01",
                "machine_type": "washing",
                "location": f"勤軒{floor}樓洗衣間"
            })
        
        # 1樓烘衣機（2台）
        machines.extend([
            {
                "machine_code": "D-QX-1F-01",
                "machine_type": "drying",
                "location": "勤軒1樓洗衣間"
            },
            {
                "machine_code": "D-QX-1F-02",
                "machine_type": "drying",
                "location": "勤軒1樓洗衣間"
            }
        ])
        
        return machines
    
    def _get_static_machines(self):
        """獲取靜態機器配置"""
        # 根據區域名稱生成機器
        region_configs = {
            "誠軒": self._generate_chengxuan_machines(),
            "樸軒": self._generate_puxuan_machines(),
            "華軒": self._generate_huaxuan_machines(),
            "怡軒": [],  # 沒有機器
            "勤軒": self._generate_qinxuan_machines()
        }
        
        if self.region_name in region_configs:
            return region_configs[self.region_name]
        else:
            # 自訂區域，生成簡單的機器配置
            return [
                {
                    "machine_code": f"W-{self.region_name}-01",
                    "machine_type": "washing",
                    "location": f"{self.region_name}1樓洗衣間"
                },
                {
                    "machine_code": f"D-{self.region_name}-01", 
                    "machine_type": "drying",
                    "location": f"{self.region_name}1樓洗衣間"
                }
            ]
    
    def _start_status_reporter(self):
        """啟動狀態報告線程"""
        def report_loop():
            while self.running:
                self._report_status()
                # 每30秒報告一次狀態，避免429錯誤
                for _ in range(300):  # 30秒 = 300 * 0.1秒
                    if not self.running:
                        break
                    time.sleep(0.1)
        
        self.reporter_thread = threading.Thread(target=report_loop, daemon=True)
        self.reporter_thread.start()
    
    def _report_status(self):
        """向伺服器報告狀態"""
        try:
            # 更新時間戳
            current_time = datetime.now().isoformat()
            for machine in self.machines:
                machine["last_update"] = current_time
            
            # 組建請求資料
            data = {
                "api_key": self.api_key,
                "region": self.region_name,
                "controller_id": self.controller_id,
                "machines": self.machines
            }
            
            # 發送請求
            response = requests.post(
                f"{self.server_url}/api/hardware/status-report",
                json=data,
                headers={'Content-Type': 'application/json'},
                timeout=10
            )
            
            if response.status_code == 200:
                pass
            elif response.status_code == 429:
                print("請求頻率過高，將延長報告間隔...")
                time.sleep(60)
            else:
                print(f"狀態報告失敗: HTTP {response.status_code}")
                
        except requests.exceptions.RequestException as e:
            print(f"網路錯誤: {e}")
        except Exception as e:
            print(f"狀態報告錯誤: {e}")

    def print_status(self):
        """顯示目前機器狀態"""
        print(f"\n{self.region_name} 控制器狀態")
        print("=" * 50)
        print(f"區域: {self.region_name}")
        print(f"控制器ID: {self.controller_id}")
        print(f"機器數量: {len(self.machines)}")
        print()
        
        # 統計各種狀態的機器數量
        status_counts = {}
        for machine in self.machines:
            status = machine["status"]
            status_counts[status] = status_counts.get(status, 0) + 1
        
        print("狀態統計:")
        for status, count in status_counts.items():
            print(f"  {status}: {count} 台")
        
        print()
        print("連接資訊:")
        print(f"  URL: {self.server_url}")
        print(f"  狀態: 每30秒自動報告")
    
    def stop(self):
        """停止控制器"""
        self.running = False
        if hasattr(self, 'reporter_thread'):
            self.reporter_thread.join(timeout=1)


def main():
    """主函數"""
    print("硬體模擬器 v2.1")
    print("=" * 50)
    print("這個模擬器可以模擬洗衣機的各種狀態，並支援手動控制")
    print("• 可用狀態: available, in_use, occupied, maintenance, locked")
    print("• 每30秒自動向伺服器報告狀態 (避免頻率限制)")
    print("• 支援手動設定機器狀態和使用時間")
    print()
    
    # 選擇區域
    print("請選擇要模擬的女宿舍區域:")
    print("1. 誠軒 (35台機器: 23洗+12烘)")
    print("2. 樸軒 (22台機器: 11洗+11烘)")
    print("3. 華軒 (6台機器: 5洗+1烘)")
    print("4. 怡軒 (0台機器)")
    print("5. 勤軒 (8台機器: 6洗+2烘)")
    print("6. 自訂區域")
    
    choice = input("請輸入選項 (1-6): ").strip()
    
    region_map = {
        "1": "誠軒",
        "2": "樸軒", 
        "3": "華軒",
        "4": "怡軒",
        "5": "勤軒"
    }
    
    if choice in region_map:
        region_name = region_map[choice]
    elif choice == "6":
        region_name = input("請輸入區域名稱: ").strip() or "自訂區域"
    else:
        print("無效選項，使用預設區域: 誠軒")
        region_name = "誠軒"
    
    # 選擇服務器
    default_server_url = os.environ.get('SIMULATOR_SERVER_URL', 'http://localhost:3000')
    print(f"\n請選擇要連接的服務器:")
    print(f"1. 使用預設服務器 ({default_server_url})")
    print("2. 自訂服務器 URL")
    
    try:
        server_choice = input("請輸入選項 (1-2, 預設1): ").strip()
    except EOFError:
        server_choice = "1"
    
    if server_choice == "2":
        custom_url = input("請輸入服務器URL (例如 https://example.com:3000): ").strip()
        server_url = custom_url or default_server_url
    else:
        server_url = default_server_url
    
    print(f"\n啟動 {region_name} 硬體控制器...")
    print(f"連接至: {server_url}")
    
    # 創建並啟動控制器
    controller = SimpleHardwareController(region_name, server_url)
    
    # 顯示初始狀態
    controller.print_status()
    
    print(f"\n{'='*50}")
    print("控制器已啟動，可用指令:")
    print("  status    - 顯示狀態")
    print("  list      - 列出所有機器")
    print("  help      - 顯示說明")
    print("  quit      - 退出")
    print("="*50)
    
    # 命令行循環
    try:
        while True:
            try:
                command = input(f"\n[{region_name}] 請輸入指令: ").strip().lower()
            except EOFError:
                print("\n自動顯示狀態...")
                command = "status"
            
            if command in ["quit", "exit", "q"]:
                print("\n正在停止控制器...")
                controller.stop()
                break
                
            elif command == "status":
                controller.print_status()
                
            elif command == "list":
                print(f"\n{region_name} 機器列表:")
                print("-" * 60)
                for i, machine in enumerate(controller.machines, 1):
                    print(f"{i:2d}. {machine['machine_code']} - {machine['location']} ({machine['machine_type']}) [{machine['status']}]")
                
            elif command == "help":
                print("\n硬體控制器說明:")
                print("-" * 50)
                print("• 這個模擬器會模擬洗衣機硬體控制器的行為")
                print("• 每30秒自動向服務器報告所有機器的狀態")
                print("• 前端會即時顯示機器狀態")
                print("• 可以透過前端或LINE Bot與機器互動")
                print()
                print("機器狀態說明:")
                print("  available   - 可用")
                print("  in_use      - 使用中")
                print("  occupied    - 已預約")
                print("  maintenance - 維護中")
                print("  locked      - 鎖定")
                
            else:
                print("未知指令")
                print("可用指令: status, list, help, quit")
                
    except KeyboardInterrupt:
        print("\n\n收到中斷信號，正在停止控制器...")
        controller.stop()
        
    print("控制器已停止")


if __name__ == "__main__":
    main()