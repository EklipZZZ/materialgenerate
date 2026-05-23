#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
数据库操作模块
"""

import sqlite3

class Database:
    def __init__(self, db_path):
        """初始化数据库连接"""
        self.db_path = db_path
        self.connection = None
        
    def connect(self):
        """连接数据库"""
        self.connection = sqlite3.connect(self.db_path)
        return self.connection
        
    def close(self):
        """关闭数据库连接"""
        if self.connection:
            self.connection.close()
            
    def execute(self, sql, params=None):
        """执行SQL语句"""
        cursor = self.connection.cursor()
        if params:
            cursor.execute(sql, params)
        else:
            cursor.execute(sql)
        self.connection.commit()
        return cursor
