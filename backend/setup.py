from setuptools import setup

setup(
    name='cottonway',
    version='0.0.1',
    description="cottonway.club web application",
    platforms=['Any'],
    packages=['cottonway'],
    include_package_data=True,
    zip_safe=False,
    entry_points={
        'autobahn.twisted.wamplet': [
            'backend = cottonway.cottonway:AppSession'
        ],
    }
)
