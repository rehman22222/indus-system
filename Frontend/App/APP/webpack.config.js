const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const webpack = require('webpack');
const TerserPlugin = require('terser-webpack-plugin');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');
const CompressionPlugin = require('compression-webpack-plugin');

// Load environment variables from .env file
const dotenv = require('dotenv');
const result = dotenv.config();

if (result.error) {
    console.warn('Warning: .env file not found or could not be loaded');
}

module.exports = (env, argv) => {
    const isProduction = argv.mode === 'production' || process.env.NODE_ENV === 'production';
    
    console.log('--- Webpack Build Config ---');
    console.log('Mode:', isProduction ? 'production' : 'development');
    console.log('VITE_API_BASE_URL:', process.env.VITE_API_BASE_URL || process.env.VITE_API_URL || 'http://localhost:5000');
    console.log('----------------------------');

    // Prepare environment variables for DefinePlugin
    // We define both the object and the individual properties for maximum compatibility
    const envVars = {
        'process.env.NODE_ENV': JSON.stringify(isProduction ? 'production' : 'development'),
        'import.meta.env': JSON.stringify({
            MODE: isProduction ? 'production' : 'development',
            DEV: !isProduction,
            PROD: isProduction,
            VITE_API_BASE_URL: process.env.VITE_API_BASE_URL || process.env.VITE_API_URL || 'http://localhost:5000',
            VITE_API_URL: process.env.VITE_API_URL || process.env.VITE_API_BASE_URL || 'http://localhost:5000',
        }),
        'import.meta.env.MODE': JSON.stringify(isProduction ? 'production' : 'development'),
        'import.meta.env.DEV': JSON.stringify(!isProduction),
        'import.meta.env.PROD': JSON.stringify(isProduction),
        'import.meta.env.VITE_API_BASE_URL': JSON.stringify(process.env.VITE_API_BASE_URL || process.env.VITE_API_URL || 'http://localhost:5000'),
        'import.meta.env.VITE_API_URL': JSON.stringify(process.env.VITE_API_URL || process.env.VITE_API_BASE_URL || 'http://localhost:5000'),
    };

    return {
        entry: './index.web.js',
        // FIX: Use memory cache to prevent stale disk cache loops
        cache: {
            type: 'memory',
        },
        output: {
            path: path.resolve(__dirname, 'dist'),
            filename: isProduction ? '[name].[contenthash].js' : 'bundle.js',
            chunkFilename: isProduction ? '[name].[contenthash].chunk.js' : '[name].chunk.js',
            clean: true,
            publicPath: '/',
        },
        resolve: {
            alias: {
                'react-native': 'react-native-web',
                '@acme/core-api': path.resolve(__dirname, 'src/services/core-api.ts'),
                '@': path.resolve(__dirname, 'src'),
            },
            extensions: ['.web.js', '.js', '.web.ts', '.ts', '.web.tsx', '.tsx', '.json'],
            modules: [
                path.resolve(__dirname, 'node_modules'),
                'node_modules',
            ],
        },
        module: {
            rules: [
                {
                    test: /\.(js|jsx|ts|tsx)$/,
                    exclude: /node_modules/,
                    include: [
                        path.resolve(__dirname, 'src'),
                        path.resolve(__dirname, 'index.web.js'),
                    ],
                    use: {
                        loader: 'babel-loader',
                        options: {
                            presets: [
                                ['@babel/preset-env', {
                                    targets: '> 0.25%, not dead',
                                    useBuiltIns: 'usage',
                                    corejs: 3,
                                }],
                                '@babel/preset-react',
                                ['@babel/preset-typescript', { isTSX: true, allExtensions: true }],
                            ],
                            plugins: [
                                ['@babel/plugin-transform-class-properties', { loose: true }],
                                ['@babel/plugin-transform-private-methods', { loose: true }],
                                ['@babel/plugin-transform-private-property-in-object', { loose: true }],
                                'react-native-web',
                            ],
                            cacheDirectory: true,
                        },
                    },
                },
                {
                    test: /\.(png|jpe?g|gif|svg)$/i,
                    type: 'asset',
                    parser: {
                        dataUrlCondition: {
                            maxSize: 8 * 1024, // 8kb
                        },
                    },
                },
                {
                    test: /\.css$/,
                    use: ['style-loader', 'css-loader', 'postcss-loader'],
                },
            ],
        },
        plugins: [
            new HtmlWebpackPlugin({
                template: './public/index.html',
                minify: isProduction ? {
                    removeComments: true,
                    collapseWhitespace: true,
                    removeRedundantAttributes: true,
                    useShortDoctype: true,
                    removeEmptyAttributes: true,
                    removeStyleLinkTypeAttributes: true,
                    keepClosingSlash: true,
                    minifyJS: true,
                    minifyCSS: true,
                    minifyURLs: true,
                } : false,
            }),
            new webpack.DefinePlugin(envVars),
            new webpack.ProvidePlugin({
                React: 'react',
            }),
            ...(isProduction ? [
                new CompressionPlugin({
                    algorithm: 'gzip',
                    test: /\.(js|css|html|svg)$/,
                    threshold: 8192,
                    minRatio: 0.8,
                }),
            ] : []),
        ],
        optimization: {
            minimize: isProduction,
            minimizer: [
                new TerserPlugin({
                    terserOptions: {
                        parse: {
                            ecma: 8,
                        },
                        compress: {
                            ecma: 5,
                            warnings: false,
                            comparisons: false,
                            inline: 2,
                            drop_console: isProduction,
                        },
                        mangle: {
                            safari10: true,
                        },
                        output: {
                            ecma: 5,
                            comments: false,
                            ascii_only: true,
                        },
                    },
                }),
                new CssMinimizerPlugin(),
            ],
            splitChunks: isProduction ? {
                chunks: 'all',
                cacheGroups: {
                    // React Native Web (the largest dependency)
                    reactNativeWeb: {
                        test: /[\\/]node_modules[\\/]react-native-web[\\/]/,
                        name: 'react-native-web',
                        priority: 30,
                    },
                    // React and React-DOM
                    react: {
                        test: /[\\/]node_modules[\\/](react|react-dom)[\\/]/,
                        name: 'react-vendor',
                        priority: 20,
                    },
                    // All other vendors
                    vendor: {
                        test: /[\\/]node_modules[\\/]/,
                        name: 'vendors',
                        priority: 10,
                    },
                    common: {
                        minChunks: 2,
                        priority: 5,
                        reuseExistingChunk: true,
                    },
                },
            } : false,
            runtimeChunk: isProduction ? 'single' : false,
        },
        performance: {
            // Suppress warnings for React Native Web - it's expected to be large
            hints: false, // Set to false to suppress all performance warnings
            maxEntrypointSize: 1024000, // 1MB - increased for React Native Web
            maxAssetSize: 1024000, // 1MB - increased for React Native Web
        },
        devServer: {
            port: 3001,
            hot: true,
            liveReload: false,
            open: true,
            historyApiFallback: true,
            compress: true,
            allowedHosts: 'all',
            static: {
                directory: path.join(__dirname, 'public'),
            },
            client: {
                overlay: {
                    errors: true,
                    warnings: false,
                },
            },
            watchFiles: {
                paths: ['src/**/*', 'public/**/*'],
                options: {
                    ignored: ['**/node_modules/**', '**/dist/**', '**/.git/**'],
                },
            },
        },
        devtool: isProduction ? 'source-map' : 'eval-source-map',
    };
};
