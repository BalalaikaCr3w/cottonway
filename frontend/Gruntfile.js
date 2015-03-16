module.exports = function (grunt) {

    grunt.initConfig({

        pkg: grunt.file.readJSON('package.json'),

        htmlbuild: {
            dist: {
                src: 'app/index.html',
                dest: 'public/',
                options: {
                    beautify: true
                }
            }
        },

        less: {
            prod: {
                options: {
                    compress: true,
                    cleancss: true,
                    report: 'gzip'
                },
                files: {
                    'public/index.css': [
                        'app/index.less'
                    ]
                }
            }
        },

        ngtemplates:  {
            app:        {
                src: ['app/modules/**/*.html', 'app/ui/**/*.html'],
                dest: 'templates.js',
                options:  {
                    bootstrap: function (module, script) {
                        return 'var angular = require(\'angular\');\n' +
                            'angular.module(\'' + module + '\').run([\'$templateCache\', function($templateCache) {\n' + script + '}]);';
                    },
                    htmlmin: {
                        collapseBooleanAttributes: true,
                        collapseWhitespace: true,
                        removeComments: true,
                        removeEmptyAttributes: true,
                        removeRedundantAttributes: true,
                        removeScriptTypeAttributes: true,
                        removeStyleLinkTypeAttributes: true
                    }
                }
            }
        },

        browserify: {
            dev: {
                options: {
                    browserifyOptions: {
                        debug: true
                    }
                },
                files: {
                    'public/index.js': ['app/index.js']
                }
            },
            prod: {
                files: {
                    'public/index.js': ['app/index.js']
                }
            }
        },

        uglify: {
            app: {
                files: {
                    'public/index.js': ['public/index.js']
                },
                report: 'gzip'
            }
        },

        copy: {
            main: {
                files: [
                    {
                        cwd: 'node_modules/font-awesome',
                        src: 'fonts/*',
                        dest: 'public/',
                        expand: true
                    }
                ]
            }
        },

        clean: ['templates.js'],

        watch: {
            scripts: {
                files: ['Gruntfile.js', 'app/**/*.js'],
                tasks: ['browserify:dev']
            },
            css: {
                files: ['app/**/*.less'],
                tasks: ['less:prod']
            },
            html: {
                files: ['app/**/*.html', '!app/index.html'],
                tasks: ['ngtemplates', 'browserify:dev']
            },
            index: {
                files: ['app/index.html'],
                tasks: ['ngtemplates', 'browserify:dev', 'htmlbuild']
            }
        }
    });

    grunt.loadNpmTasks('grunt-angular-templates');
    grunt.loadNpmTasks('grunt-browserify');
    grunt.loadNpmTasks('grunt-contrib-less');
    grunt.loadNpmTasks('grunt-contrib-clean');
    grunt.loadNpmTasks('grunt-contrib-copy');
    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-contrib-watch');
    grunt.loadNpmTasks('grunt-html-build');

    grunt.registerTask('build', [
        'htmlbuild',
        'less:prod',
        'ngtemplates',
        'browserify:prod',
        'uglify',
        "copy",
        'clean'
    ]);

    grunt.registerTask('build-dev', [
        'htmlbuild',
        'less:prod',
        'ngtemplates',
        'browserify:dev',
        "copy"
    ]);
};
