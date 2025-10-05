import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, existsSync } from 'fs';
import path from 'path';

export async function POST(req: NextRequest) {
    const { basePath } = await req.json();
    
    try {
        // Buscar archivos de configuración comunes
        const possibleConfigFiles = [
            'package.json',
            'ormconfig.json',
            'ormconfig.js',
            'typeorm.config.js',
            'typeorm.config.ts',
            'database.config.js',
            'database.config.ts',
            'src/config/database.config.ts',
            'src/config/database.ts',
            'src/database/database.config.ts',
            'src/database/database.ts'
        ];

        let databaseType = 'unknown';
        let configFound = false;

        // Buscar en package.json por dependencias
        const packageJsonPath = path.join(basePath, 'package.json');
        if (existsSync(packageJsonPath)) {
            const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
            const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
            
            if (dependencies['pg'] || dependencies['postgres'] || dependencies['postgresql']) {
                databaseType = 'postgresql';
                configFound = true;
            } else if (dependencies['mysql2'] || dependencies['mysql']) {
                databaseType = 'mysql';
                configFound = true;
            } else if (dependencies['sqlite3'] || dependencies['better-sqlite3']) {
                databaseType = 'sqlite';
                configFound = true;
            } else if (dependencies['mssql'] || dependencies['@types/mssql']) {
                databaseType = 'mssql';
                configFound = true;
            } else if (dependencies['oracledb'] || dependencies['oracle']) {
                databaseType = 'oracle';
                configFound = true;
            }
        }

        // Buscar en archivos de configuración específicos
        if (!configFound) {
            for (const configFile of possibleConfigFiles) {
                const configPath = path.join(basePath, configFile);
                if (existsSync(configPath)) {
                    try {
                        const content = readFileSync(configPath, 'utf-8');
                        
                        // Buscar patrones específicos de base de datos
                        if (content.includes('postgres') || content.includes('postgresql') || content.includes('pg://')) {
                            databaseType = 'postgresql';
                            break;
                        } else if (content.includes('mysql') || content.includes('mysql2') || content.includes('mysql://')) {
                            databaseType = 'mysql';
                            break;
                        } else if (content.includes('sqlite') || content.includes('.db') || content.includes('.sqlite')) {
                            databaseType = 'sqlite';
                            break;
                        } else if (content.includes('mssql') || content.includes('sqlserver') || content.includes('mssql://')) {
                            databaseType = 'mssql';
                            break;
                        } else if (content.includes('oracle') || content.includes('oracledb')) {
                            databaseType = 'oracle';
                            break;
                        }
                    } catch (error) {
                        // Continuar con el siguiente archivo
                        continue;
                    }
                }
            }
        }

        // Buscar en archivos de entorno
        const envFiles = ['.env', '.env.local', '.env.development', '.env.production'];
        for (const envFile of envFiles) {
            const envPath = path.join(basePath, envFile);
            if (existsSync(envPath)) {
                try {
                    const content = readFileSync(envPath, 'utf-8');
                    
                    if (content.includes('DATABASE_URL') || content.includes('DB_URL')) {
                        const urlMatch = content.match(/(?:DATABASE_URL|DB_URL)\s*=\s*(.+)/);
                        if (urlMatch) {
                            const url = urlMatch[1].trim();
                            if (url.includes('postgres') || url.includes('postgresql')) {
                                databaseType = 'postgresql';
                                break;
                            } else if (url.includes('mysql')) {
                                databaseType = 'mysql';
                                break;
                            } else if (url.includes('sqlite')) {
                                databaseType = 'sqlite';
                                break;
                            } else if (url.includes('mssql') || url.includes('sqlserver')) {
                                databaseType = 'mssql';
                                break;
                            } else if (url.includes('oracle')) {
                                databaseType = 'oracle';
                                break;
                            }
                        }
                    }
                } catch (error) {
                    // Continuar con el siguiente archivo
                    continue;
                }
            }
        }

        return NextResponse.json({ 
            databaseType,
            configFound: databaseType !== 'unknown'
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return NextResponse.json({ 
            error: `Error al detectar la base de datos: ${message}`,
            databaseType: 'unknown'
        }, { status: 500 });
    }
} 